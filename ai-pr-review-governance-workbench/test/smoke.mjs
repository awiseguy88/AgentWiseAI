import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'pr-oversized.json'), 'utf8'));
const withinFixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'pr-within-limits.json'), 'utf8'));

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'argw-')), 'test.db');
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.MAX_LINES = '500';
process.env.MAX_FILES = '10';

const { createServer } = await import('../src/server.js');
const { listItems } = await import('../src/db.js');

const app = createServer();
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

function sign(body, secret = process.env.WEBHOOK_SECRET) {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

async function sendWebhook(payload, signature) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (signature) headers['x-hub-signature-256'] = signature;
  if (payload) headers['x-github-event'] = 'pull_request';
  const res = await fetch(base + '/api/webhooks/github', { method: 'POST', headers, body });
  let json;
  try { json = await res.json(); } catch { json = await res.text(); }
  return { status: res.status, json };
}

async function fetchJson(url, opts) {
  const res = await fetch(base + url, opts);
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

test('health check', async () => {
  const r = await fetchJson('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
});

test('acceptance 1: oversized PR (~2,400 lines / ~38 files) flagged as sprawl, send-back-to-rescope records comment + needs-rescope label', async () => {
  // Build a real GitHub-like pull_request payload using the fixture diff
  const oversizedPayload = {
    action: 'opened',
    number: fixtures.number,
    title: fixtures.title,
    user: { login: fixtures.author },
    html_url: fixtures.html_url,
    additions: fixtures.additions,
    deletions: fixtures.deletions,
    changed_files: fixtures.changed_files,
    repository: { full_name: fixtures.repository },
    diff: fixtures.diff,
  };
  const body = JSON.stringify(oversizedPayload);
  const signature = sign(body);

  const r = await sendWebhook(body, signature);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.sprawl, true, 'oversized PR flagged as sprawl');

  const items = await fetchJson('/api/sprawl');
  assert.equal(items.status, 200);
  const sprawlItem = items.json.find(i => i.repo === 'awiseguy88/AgentWiseAI' && i.pr_number === fixtures.number);
  assert.ok(sprawlItem, 'sprawl item created on dashboard');
  assert.equal(sprawlItem.status, 'sprawl');
  assert.ok(sprawlItem.lines > 500, `lines ${sprawlItem.lines} exceeds threshold`);
  assert.equal(sprawlItem.files, 38, 'file count recorded');

  // Send back to rescope
  const rescope = await fetchJson(`/api/sprawl/${sprawlItem.id}/rescope`, { method: 'POST' });
  assert.equal(rescope.status, 200, JSON.stringify(rescope.json));
  assert.equal(rescope.json.status, 'rescoped');
  assert.ok(rescope.json.action.mock, 'mock GitHub action recorded (no real token)');
  assert.equal(rescope.json.action.label.name, 'needs-rescope');
  assert.equal(rescope.json.action.comment.posted, false, 'mock: not actually posted');

  const afterItems = await fetchJson('/api/sprawl');
  const updated = afterItems.json.find(i => i.id === sprawlItem.id);
  assert.equal(updated.status, 'rescope');
  assert.ok(updated.rescope_action, 'rescope action recorded');
  const parsedAction = JSON.parse(updated.rescope_action);
  assert.equal(parsedAction.label.name, 'needs-rescope');
});

test('acceptance 2: within-limits PR not flagged, no dashboard item, reviewer proceeds normally', async () => {
  const withinPayload = {
    action: 'opened',
    number: withinFixtures.number,
    title: withinFixtures.title,
    user: { login: withinFixtures.author },
    html_url: withinFixtures.html_url,
    additions: withinFixtures.additions,
    deletions: withinFixtures.deletions,
    changed_files: withinFixtures.changed_files,
    repository: { full_name: withinFixtures.repository },
    diff: withinFixtures.diff,
  };
  const body = JSON.stringify(withinPayload);
  const signature = sign(body);

  const r = await sendWebhook(body, signature);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.sprawl, false, 'within-limits PR not flagged');

  const items = await fetchJson('/api/sprawl');
  const exists = items.json.find(i => i.repo === withinFixtures.repository && i.pr_number === withinFixtures.number);
  assert.equal(exists, undefined, 'no dashboard item created for within-limits PR');
});

test('acceptance 3: invalid/missing webhook signature -> HTTP 401, rejected and logged, no dashboard item', async () => {
  // Missing signature
  const noSigBody = JSON.stringify({ action: 'opened', number: 999, pull_request: { number: 999, title: 'test', user: { login: 'x' }, repository: { full_name: 'a/b' } } });
  const noSig = await sendWebhook(noSigBody, null);
  assert.equal(noSig.status, 401, JSON.stringify(noSig.json));

  // Invalid signature
  const badSig = await sendWebhook(noSigBody, 'sha256=deadbeef');
  assert.equal(badSig.status, 401, JSON.stringify(badSig.json));

  // No dashboard item created
  const items = await fetchJson('/api/sprawl');
  const exists = items.json.find(i => i.repo === 'a/b' && i.pr_number === 999);
  assert.equal(exists, undefined, 'no dashboard item for rejected webhook');

  // Rejection logged
  const log = await fetchJson('/api/webhook-log');
  assert.ok(log.json.some(l => l.signature_valid === 0), 'invalid signature logged');
});

test.after(() => {
  server.close();
  const dbPath = process.env.DB_PATH;
  try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch {}
});

console.log('Smoke tests defined for port', port);