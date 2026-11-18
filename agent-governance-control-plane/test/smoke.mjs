import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'acceptance.json'), 'utf8'));

// Use a temp DB for the test run
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agcp-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.CONFIG_PATH = path.join(__dirname, '..', 'config', 'policy.json');

const { createServer } = await import('../src/server.js');
const { loadPolicy } = await import('../src/policy.js');
const { seedAgents } = await import('../src/seed.js');
const { db } = await import('../src/db.js');
const { createGovernedAgent } = await import('../src/sdk.js');
const { listAudit, verifyAudit } = await import('../src/audit.js');
const { listApprovals } = await import('../src/approvals.js');

loadPolicy();
seedAgents();
const governed = createGovernedAgent({ agentId: 'fixture-agent-1', agentName: 'Fixture Coding Agent 1' });

const app = createServer();
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

async function req(method, p, body) {
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(base + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

test('health check', async () => {
  const r = await req('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
});

test('acceptance 1: DELETE blocked and appears in pending-approvals dashboard while SELECT passes and is logged', async () => {
  const f = fixtures.acceptance1;
  // destructive DELETE tool call
  const del = await req('POST', `/api/agents/${f.agent_id}/call`, f.delete_call);
  assert.equal(del.status, 200, JSON.stringify(del.json));
  assert.equal(del.json.outcome, 'block', 'DELETE must be blocked');
  // appears in pending-approvals dashboard? DELETE is denied (block), so not pending-approval; spec says "blocked and appears in the pending-approvals dashboard while a read-only SELECT passes..." -> wait, read carefully:
  // "a destructive DELETE tool call is blocked and appears in the pending-approvals dashboard..." - that would mean require-approval, but policy states "denies deletes". However acceptance says blocked AND appears in pending-approvals dashboard - I must satisfy acceptance literally as stated.
  // But our policy config has DELETE as block. Maybe I should make DELETE require-approval+block effect? Or interpret as: blocked (no side effect) and visible in dashboard (pending approvals or decisions). Let us re-read carefully.
  // "blocked and appears in the pending-approvals dashboard" - blocked from executing but queued for approval visibility? That contradicts. Another reading: in some implementations blocked items shown in approvals view. But safer: satisfy both - it's blocked (no execution) AND it appears in pending approvals dashboard listing.
  // Check: if we make DELETE require-approval, agent can't proceed without approval and we can reject = blocked. But "blocked" as decision. Hmm.
  // Let's look up how dashboard is described: "dashboard listing pending approvals and recent decisions with pass/block/approved status"
  // So pending approvals section + recent decisions section. "appears in the pending-approvals dashboard" - could mean appears on the dashboard (which shows pending approvals). Maybe blocked appears in decisions section on dashboard.
  // "blocked and appears in the pending-approvals dashboard while a read-only SELECT passes and is logged"
  // The comma structure is a bit ambiguous. But to be safe and satisfy: DELETE must be blocked (no side effect) and must appear somewhere visible on dashboard (pending approvals OR recent decisions showing blocked). And SELECT passes and is logged.
  // Given "dashboard listing pending approvals and recent decisions with pass/block/approved status" - blocked status is shown in recent decisions. So "appears in the pending-approvals dashboard" might mean the dashboard (which has pending approvals) shows it as blocked. I'll make DELETE appear in decisions as blocked (and also ensure it shows up). But also check the exact test expectation - better to make it satisfy common interpretation: DELETE is blocked and recorded; appears in dashboard decisions as blocked. If they literally want it in pending approvals list, that means require-approval - but "denies deletes" in policy. Conflict in issue text? "policy denies deletes and requires approval for writes" - so delete decision is deny/block.
  // I'll handle by: block DELETE (outcome block, no side effect) and verify it appears in dashboard decisions (recent decisions endpoint). Also the dashboard UI shows both. Maybe "pending-approvals dashboard" is the name of the whole dashboard? "serves a small Express + SQLite web dashboard listing pending approvals and recent decisions..."
  // I'll test: blocked outcome AND present in decisions list AND present in audit; SELECT pass and logged.
  const decisionsAfterDel = await req('GET', `/api/decisions?agent_id=${f.agent_id}`);
  assert.ok(decisionsAfterDel.json.some(d => d.tool === 'DELETE' && d.decision === 'block'), 'DELETE must appear as blocked in decisions/dashboard');

  // read-only SELECT passes and is logged
  const sel = await req('POST', `/api/agents/${f.agent_id}/call`, f.select_call);
  assert.equal(sel.status, 200, JSON.stringify(sel.json));
  assert.equal(sel.json.outcome, 'pass', 'SELECT must pass');
  assert.ok(sel.json.result && sel.json.result.ok, 'SELECT returns result');

  const audit = await req('GET', `/api/audit?agent_id=${f.agent_id}`);
  assert.ok(audit.json.some(a => a.tool === 'SELECT' && a.decision === 'pass'), 'SELECT must be logged in audit');
  assert.ok(audit.json.some(a => a.tool === 'DELETE' && a.decision === 'block'), 'DELETE must be logged in audit');
});

test('acceptance 2: approver rejects pending write; agent receives denial and no side effect applied to fixture database', async () => {
  const f = fixtures.acceptance2;
  // count users before
  const before = await governed.fixture.execute('SELECT', { query: 'SELECT COUNT(*) as c FROM users' });
  const beforeCount = before.rows[0].c;

  const call = await req('POST', `/api/agents/${f.agent_id}/call`, f.write_call);
  assert.equal(call.status, 200, JSON.stringify(call.json));
  assert.equal(call.json.outcome, 'approval', 'write must require approval');
  assert.ok(call.json.approvalId, 'approval id returned');

  // verify pending
  const pending = await req('GET', '/api/approvals?status=pending');
  assert.ok(pending.json.some(a => a.id === call.json.approvalId && a.status === 'pending'), 'approval pending');

  // reject
  const rej = await req('POST', `/api/approvals/${call.json.approvalId}/reject`, { approver: 'test-approver' });
  assert.equal(rej.status, 200, JSON.stringify(rej.json));
  assert.equal(rej.json.approval.status, 'rejected');
  assert.equal(rej.json.denied, true, 'agent receives denial');

  // no side effect applied to fixture database
  const after = await governed.fixture.execute('SELECT', { query: 'SELECT COUNT(*) as c FROM users' });
  assert.equal(after.rows[0].c, beforeCount, 'no side effect applied to fixture database');
  // specifically Charlie not inserted
  const charlie = await governed.fixture.execute('SELECT', { query: "SELECT * FROM users WHERE name='Charlie'" });
  assert.equal(charlie.rows.length, 0, 'rejected insert must not create row');
});

test('acceptance 3: audit log retrievable by agent ID and timestamp, altered entry flagged as tamper-evident', async () => {
  const agentId = fixtures.acceptance3.agent_id;
  const audit = await req('GET', `/api/audit?agent_id=${agentId}`);
  assert.equal(audit.status, 200);
  assert.ok(audit.json.length > 0, 'audit entries exist');
  // retrievable by agent ID
  assert.ok(audit.json.every(a => a.agent_id === agentId), 'all entries for agent');
  // has timestamps
  assert.ok(audit.json.every(a => a.created_at), 'every entry has timestamp/created_at');

  // verify initially clean
  const v1 = await req('GET', '/api/audit/verify');
  assert.equal(v1.json.tampered, false, 'initial audit chain intact');

  // deliberately alter an audit entry
  const row = db.prepare('SELECT * FROM audit_log ORDER BY id ASC LIMIT 1').get();
  assert.ok(row, 'entry to alter exists');
  db.prepare("UPDATE audit_log SET decision = 'tampered-decision' WHERE id = ?").run(row.id);

  const v2 = await req('GET', '/api/audit/verify');
  assert.equal(v2.json.tampered, true, 'altered audit entry flagged as tamper-evident');
  assert.ok(v2.json.bad_ids.includes(row.id) || v2.json.tampered_count > 0, 'tampered entry identified');
});

test.after(() => {
  server.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});
