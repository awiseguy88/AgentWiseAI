const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

function makeTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-launcher-ws-'));
  fs.mkdirSync(path.join(root, 'alpha-tool'));
  fs.writeFileSync(
    path.join(root, 'alpha-tool', 'README.md'),
    '# Alpha Tool\n\nAlpha helps with alpha tasks.\n\n## Details\nMore.'
  );
  fs.mkdirSync(path.join(root, 'beta-tool'));
  fs.writeFileSync(
    path.join(root, 'beta-tool', 'README.md'),
    '# Beta Tool\n\nBeta helps with beta tasks.'
  );
  fs.mkdirSync(path.join(root, 'no-readme-tool'));
  fs.mkdirSync(path.join(root, '.hidden-tool'));
  fs.writeFileSync(path.join(root, '.hidden-tool', 'README.md'), '# Hidden\n\nShould not show.');
  return root;
}

test('scanTools finds tools with README and extracts title/summary', () => {
  const ws = makeTempWorkspace();
  const prev = process.env.WORKSPACE_ROOT;
  process.env.WORKSPACE_ROOT = ws;
  const modPath = path.join(__dirname, '..', 'server.js');
  delete require.cache[require.resolve(modPath)];
  const { scanTools } = require(modPath);
  const tools = scanTools();
  assert.equal(tools.length, 2);
  const alpha = tools.find(t => t.folder === 'alpha-tool');
  assert.ok(alpha);
  assert.equal(alpha.title, 'Alpha Tool');
  assert.match(alpha.summary, /Alpha helps with alpha tasks/);
  assert.equal(alpha.launchUrl, '/tool/alpha-tool');
  const names = tools.map(t => t.folder).sort();
  assert.deepEqual(names, ['alpha-tool', 'beta-tool']);
  process.env.WORKSPACE_ROOT = prev;
});

test('HTTP endpoints list and launch tools', async () => {
  const ws = makeTempWorkspace();
  const prev = process.env.WORKSPACE_ROOT;
  process.env.WORKSPACE_ROOT = ws;
  const modPath = path.join(__dirname, '..', 'server.js');
  delete require.cache[require.resolve(modPath)];
  const { app } = require(modPath);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/api/tools`);
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.tools.length, 2);
    const toolRes = await fetch(`http://127.0.0.1:${port}/api/tools/alpha-tool`);
    assert.equal(toolRes.status, 200);
    const tool = await toolRes.json();
    assert.match(tool.readme, /# Alpha Tool/);
    const pageRes = await fetch(`http://127.0.0.1:${port}/tool/alpha-tool`);
    assert.equal(pageRes.status, 200);
    const html = await pageRes.text();
    assert.match(html, /Alpha Tool/);
    assert.match(html, /Alpha helps with alpha tasks/);
    assert.match(html, /target="_blank"|Launch/i); // page is launch target; contains tool content
  } finally {
    await new Promise(resolve => server.close(resolve));
    process.env.WORKSPACE_ROOT = prev;
  }
});
