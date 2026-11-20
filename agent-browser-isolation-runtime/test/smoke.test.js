'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ProfileStore } = require('../src/profile');
const { FixtureSite } = require('../src/fixture-site');
const { BrowserProfile } = require('../src/browser');
const { JobRunner } = require('../src/runner');
const { McpServer } = require('../src/mcp');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'abis-runtime-'));
}

test('isolated profiles keep separate user-data-dirs and cookie stores', () => {
  const root = tmpRoot();
  const store = new ProfileStore(root);
  store.create('a');
  store.create('b');
  assert.notEqual(store.userDataDir('a'), store.userDataDir('b'));
  assert.ok(fs.existsSync(store.userDataDir('a')));
  assert.ok(fs.existsSync(store.userDataDir('b')));
  store.save('a', { ...store.load('a'), cookies: { sid: { value: 'alice' } } });
  store.save('b', { ...store.load('b'), cookies: { sid: { value: 'bob' } } });
  assert.equal(store.load('a').cookies.sid.value, 'alice');
  assert.equal(store.load('b').cookies.sid.value, 'bob');
});

test('two concurrent jobs authenticate to distinct accounts with zero cross-contamination (100 runs)', async () => {
  const root = tmpRoot();
  const store = new ProfileStore(root);
  const site = new FixtureSite(0);
  await site.start();
  const base = `http://localhost:${site.port}`;
  try {
    let cross = 0;
    for (let i = 0; i < 100; i++) {
      const runner = new JobRunner({ store, baseUrl: base });
      const jobs = [
        runner.createJob({ id: `a${i}`, profile: `alice-${i}`, account: 'alice', password: 'alicepw' }),
        runner.createJob({ id: `b${i}`, profile: `bob-${i}`, account: 'bob', password: 'bobpw' }),
      ];
      const results = await runner.runConcurrent(jobs);
      const a = results[0].status === 'fulfilled' ? results[0].value : null;
      const b = results[1].status === 'fulfilled' ? results[1].value : null;
      if (!a || a.account !== 'alice' || a.items.some((it) => !it.name.startsWith('alice-'))) cross++;
      if (!b || b.account !== 'bob' || b.items.some((it) => !it.name.startsWith('bob-'))) cross++;
    }
    assert.equal(cross, 0, `expected zero cross-contamination, got ${cross}`);
  } finally {
    await site.stop();
  }
});

test('stealth config passes the bot challenge; non-stealth fails loudly', async () => {
  const root = tmpRoot();
  const store = new ProfileStore(root);
  const site = new FixtureSite(0);
  await site.start();
  const base = `http://localhost:${site.port}`;
  try {
    const good = new BrowserProfile({ store, name: 'stealthy' });
    const passed = await good.checkChallenge(base);
    good.close();
    assert.equal(passed.status, 204);
    assert.equal(passed.passed, true);

    const bad = new BrowserProfile({
      store,
      name: 'headless',
      stealth: { userAgent: 'HeadlessChrome/124', viewport: { width: 0, height: 0 }, initScript: '', realInput: false },
    });
    const failed = await bad.checkChallenge(base);
    bad.close();
    assert.equal(failed.status, 403);
    assert.equal(failed.passed, false);
  } finally {
    await site.stop();
  }
});

test('killing one job mid-run leaves the other job and its profile state intact and recoverable', async () => {
  const root = tmpRoot();
  const store = new ProfileStore(root);
  const site = new FixtureSite(0);
  await site.start();
  const base = `http://localhost:${site.port}`;
  try {
    const runner = new JobRunner({ store, baseUrl: base });
    const j1 = runner.createJob({ id: 'j1', profile: 'victim', account: 'alice', password: 'alicepw' });
    const j2 = runner.createJob({ id: 'j2', profile: 'survivor', account: 'bob', password: 'bobpw' });

    const p1 = runner.runJob(j1);
    const p2 = runner.runJob(j2);
    // Give the jobs a moment, then kill the first.
    await new Promise((r) => setTimeout(r, 50));
    runner.killJob('j1');

    await p1.catch(() => null);
    const survivor = await p2;
    assert.equal(survivor.account, 'bob');
    assert.ok(survivor.items.every((it) => it.name.startsWith('bob-')));

    // Victim's state file must still exist and be recoverable on restart.
    assert.ok(store.exists('victim'));
    const recovered = runner.recoverJob('j1');
    assert.equal(recovered.status, 'created');
    assert.ok(store.load('victim').version >= 1);
  } finally {
    await site.stop();
  }
});

test('MCP server exposes navigate/click/type/screenshot/extract and isolates by profile', async () => {
  const root = tmpRoot();
  const store = new ProfileStore(root);
  const site = new FixtureSite(0);
  await site.start();
  const base = `http://localhost:${site.port}`;
  try {
    const server = new McpServer({ store });
    const list = await server.handle({ id: 1, method: 'tools/list' });
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['click', 'extract', 'navigate', 'screenshot', 'type']);

    await server.handle({ id: 2, method: 'tools/call', params: { name: 'navigate', arguments: { profile: 'p1', url: `${base}/` } } });
    await server.handle({ id: 3, method: 'tools/call', params: { name: 'type', arguments: { profile: 'p1', selector: '#username', text: 'alice' } } });
    await server.handle({ id: 4, method: 'tools/call', params: { name: 'type', arguments: { profile: 'p1', selector: '#password', text: 'alicepw' } } });
    await server.handle({ id: 5, method: 'tools/call', params: { name: 'click', arguments: { profile: 'p1', selector: '#login', loginUrl: `${base}/login` } } });
    const extracted = await server.handle({ id: 6, method: 'tools/call', params: { name: 'extract', arguments: { profile: 'p1', selector: '#account-data' } } });
    const payload = JSON.parse(extracted.result.content[0].text);
    assert.equal(payload.account, 'alice');
    const shot = await server.handle({ id: 7, method: 'tools/call', params: { name: 'screenshot', arguments: { profile: 'p1' } } });
    const shotPayload = JSON.parse(shot.result.content[0].text);
    assert.equal(shotPayload.format, 'png');
    assert.ok(shotPayload.base64.length > 0);

    // A second profile has no cookie for the first profile's login.
    const other = await server.handle({ id: 8, method: 'tools/call', params: { name: 'extract', arguments: { profile: 'p2', selector: '#account-data' } } });
    assert.equal(JSON.parse(other.result.content[0].text).text, '');
  } finally {
    await site.stop();
  }
});
