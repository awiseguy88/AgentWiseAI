import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'acceptance.json'), 'utf8'));

// Use a temp DB for the test run
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'valg-'));
process.env.DB_PATH = path.join(tmp, 'test.db');

const { createServer } = await import('../src/server.js');
const { seedUsers } = await import('../src/seed.js');
const { db } = await import('../src/db.js');

seedUsers();
const app = createServer();
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

async function req(method, p, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, json, setCookie, headers: res.headers };
}

async function login(username, password = 'password') {
  const r = await req('POST', '/api/login', { username, password });
  assert.equal(r.status, 200, `login ${username}: ${JSON.stringify(r.json)}`);
  const cookie = (r.setCookie || '').split(';')[0];
  return { cookie, user: r.json };
}

function idByUsername(username) {
  return db.prepare('SELECT id FROM users WHERE username=?').get(username).id;
}

test('health check', async () => {
  const r = await req('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
});

test('acceptance 1: scope expansion blocked until designated reviewer approves and audit records approver/time/scope change', async () => {
  const devA = await login('dev-a');
  const reviewer = await login('reviewer-1');
  const admin = await login('admin');

  const f = fixtures.acceptance1;
  // Create app owned by dev-a, audience team-b, initial scope read-only reports
  const created = await req('POST', '/api/apps', {
    name: f.app.name,
    owner_id: idByUsername('dev-a'),
    reviewer_id: idByUsername('reviewer-1'),
    audience: f.app.audience,
    data_scope: f.app.initialScope,
  }, admin.cookie);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const appId = created.json.id;

  // Approve initial release and complete checklist so app has a live "current release"
  const app0 = await req('GET', `/api/apps/${appId}`, null, admin.cookie);
  const initialRelease = app0.json.releases.find(r => r.status === 'pending' && r.version === '1.0.0');
  assert.ok(initialRelease, 'initial release pending');
  const approvedInitial = await req('POST', `/api/releases/${initialRelease.id}/approve`, {}, reviewer.cookie);
  assert.equal(approvedInitial.status, 200);
  await req('POST', `/api/apps/${appId}/checklist/confirm`, {}, devA.cookie);
  await req('POST', `/api/apps/${appId}/checklist/signoff`, {}, reviewer.cookie);

  const live = await req('GET', `/api/apps/${appId}`, null, admin.cookie);
  assert.equal(live.json.data_scope, f.app.initialScope);
  assert.ok(live.json.current_release_id, 'current release set');

  // Submit new release expanding scope from read-only reports to write billing records
  const submitted = await req('POST', `/api/apps/${appId}/releases`, { version: f.expandedRelease.version, data_scope: f.expandedRelease.dataScope }, devA.cookie);
  assert.equal(submitted.status, 201, JSON.stringify(submitted.json));
  assert.equal(submitted.json.status, 'pending', 'new release must be pending/blocked');
  assert.equal(submitted.json.data_scope, 'write billing records');

  // Must be blocked: pending release means launch gate blocked and app not updated to new scope
  const mid = await req('GET', `/api/apps/${appId}`, null, admin.cookie);
  assert.equal(mid.json.data_scope, f.app.initialScope, 'live scope must remain unchanged until approval');
  assert.ok(mid.json.launchGate.blocked, 'launch gate blocked while pending');
  assert.ok(mid.json.launchGate.reasons.some(r => r.includes('pending')), 'blocked due to pending release');

  // Approve by designated reviewer
  const approval = await req('POST', `/api/releases/${submitted.json.id}/approve`, {}, reviewer.cookie);
  assert.equal(approval.status, 200, JSON.stringify(approval.json));
  assert.equal(approval.json.status, 'approved');
  assert.ok(approval.json.reviewed_at, 'reviewed_at recorded');
  assert.equal(approval.json.reviewed_by, idByUsername('reviewer-1'));

  const after = await req('GET', `/api/apps/${appId}`, null, admin.cookie);
  assert.equal(after.json.data_scope, 'write billing records', 'approved release reaches users');

  // Audit log records who approved, when, and scope change requested
  const audit = await req('GET', `/api/audit?action=release_approved&targetType=release&targetId=${submitted.json.id}`, null, admin.cookie);
  assert.equal(audit.status, 200);
  assert.ok(audit.json.length >= 1, 'approval audit entry exists');
  const entry = audit.json[0];
  assert.equal(entry.actor_username, 'reviewer-1', 'who approved');
  assert.ok(entry.created_at, 'when recorded');
  const details = JSON.parse(entry.details);
  assert.equal(details.requestedScope, 'write billing records', 'scope change requested recorded');
  assert.equal(details.previousScope, 'read-only reports', 'previous scope recorded');
  assert.equal(details.scopeChange, true);
});

test('acceptance 2: new app registration generates governance checklist blocking launch until owner confirms and reviewer signs off', async () => {
  const devB = await login('dev-b');
  const reviewer = await login('reviewer-1');
  const admin = await login('admin');
  const f = fixtures.acceptance2;

  const created = await req('POST', '/api/apps', {
    name: f.app.name,
    owner_id: idByUsername('dev-b'),
    reviewer_id: idByUsername('reviewer-1'),
    audience: f.app.audience,
    data_scope: f.app.dataScope,
  }, admin.cookie);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const appId = created.json.id;

  const app = await req('GET', `/api/apps/${appId}`, null, admin.cookie);
  assert.ok(app.json.checklist, 'governance checklist generated');
  assert.equal(app.json.checklist.owner_confirmed, 0, 'owner not yet confirmed');
  assert.equal(app.json.checklist.reviewer_signed_off, 0, 'reviewer not yet signed off');
  assert.ok(app.json.launchGate.blocked, 'launch blocked initially');
  assert.ok(app.json.launchGate.reasons.some(r => /owner/.test(r) && /confirm/i.test(r)), 'blocked because owner not confirmed');
  assert.ok(app.json.launchGate.reasons.some(r => /reviewer/.test(r) && /sign/i.test(r)), 'blocked because reviewer not signed off');

  // Owner confirms data scope
  const confirm = await req('POST', `/api/apps/${appId}/checklist/confirm`, {}, devB.cookie);
  assert.equal(confirm.status, 200, JSON.stringify(confirm.json));
  const mid = await req('GET', `/api/apps/${appId}`, null, admin.cookie);
  assert.equal(mid.json.checklist.owner_confirmed, 1);
  assert.ok(mid.json.launchGate.blocked, 'still blocked until reviewer signs off');

  // Reviewer signs off
  const signoff = await req('POST', `/api/apps/${appId}/checklist/signoff`, {}, reviewer.cookie);
  assert.equal(signoff.status, 200, JSON.stringify(signoff.json));
  const after = await req('GET', `/api/apps/${appId}`, null, admin.cookie);
  assert.equal(after.json.checklist.reviewer_signed_off, 1);
  // Launch may still be blocked by pending initial release approval (correct governance),
  // but checklist gates themselves are cleared.
  assert.ok(!after.json.launchGate.reasons.some(r => /owner.*confirm|reviewer.*sign/i.test(r)), 'checklist no longer blocks');
});

test('acceptance 3: unregistered app reported via CI webhook flagged as shadow IT, blocks deployment, audit captures detection and resolution', async () => {
  const admin = await login('admin');
  const f = fixtures.acceptance3;

  const report = await req('POST', '/api/ci/report', f.webhook);
  assert.ok(report.status === 200 || report.status === 202, `status ${report.status}`);
  assert.equal(report.json.shadowIt, true, 'flagged as shadow IT');
  assert.equal(report.json.deploymentBlocked, true, 'deployment blocked');
  const reportId = report.json.reportId;
  assert.ok(reportId, 'report id returned');

  const list = await req('GET', '/api/shadow-it', null, admin.cookie);
  assert.ok(list.json.some(r => r.id === reportId && r.status === 'flagged'), 'report flagged in list');

  const detected = await req('GET', `/api/audit?action=shadow_it_detected&targetType=shadow_it&targetId=${reportId}`, null, admin.cookie);
  assert.ok(detected.json.length >= 1, 'detection captured in audit');
  const detDetails = JSON.parse(detected.json[0].details);
  assert.equal(detDetails.appName, f.webhook.app_name);

  // Resolve by registering: create/register the app then resolve
  const registered = await req('POST', '/api/apps', {
    name: f.webhook.app_name,
    owner_id: idByUsername('dev-b'),
    reviewer_id: idByUsername('reviewer-1'),
    audience: 'team-c',
    data_scope: 'read-only',
  }, admin.cookie);
  assert.equal(registered.status, 201);
  const resolve = await req('POST', `/api/shadow-it/${reportId}/resolve`, { action: 'register', app_id: registered.json.id }, admin.cookie);
  assert.equal(resolve.status, 200, JSON.stringify(resolve.json));
  assert.equal(resolve.json.status, 'resolved');

  const resolvedAudit = await req('GET', `/api/audit?action=shadow_it_resolved&targetType=shadow_it&targetId=${reportId}`, null, admin.cookie);
  assert.ok(resolvedAudit.json.length >= 1, 'resolution captured in audit');

  // Another report resolved by retirement
  const report2 = await req('POST', '/api/ci/report', { app_name: 'retired-shadow-app', changed_files: ['x.js'] });
  assert.equal(report2.json.shadowIt, true);
  const retire = await req('POST', `/api/shadow-it/${report2.json.reportId}/resolve`, { action: 'retire' }, admin.cookie);
  assert.equal(retire.status, 200);
  assert.equal(retire.json.resolved_action, 'retire');
});

test('ownership change is audited', async () => {
  const admin = await login('admin');
  const app = db.prepare("SELECT id FROM apps WHERE name='billing-reports'").get();
  assert.ok(app, 'fixture app from acceptance 1 exists');
  const changed = await req('POST', `/api/apps/${app.id}/owner`, { owner_id: idByUsername('dev-b') }, admin.cookie);
  assert.equal(changed.status, 200);
  const audit = await req('GET', `/api/audit?action=ownership_changed&targetType=app&targetId=${app.id}`, null, admin.cookie);
  assert.ok(audit.json.length >= 1);
  const d = JSON.parse(audit.json[0].details);
  assert.equal(d.toOwner, 'dev-b');
});

test.after(() => {
  server.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

console.log('Smoke tests defined for port', port);
