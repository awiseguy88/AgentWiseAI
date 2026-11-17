import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'repos.json'), 'utf8'));

// Use a temp DB for the test run
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cwcp-'));
process.env.DB_PATH = path.join(tmp, 'test.db');

const { seedFromFixtures } = await import('../src/seed.js');
const { getRepos, getRepoById, getFindings } = await import('../src/db.js');
const { analyzeRepo, remediateRepo, GitHubClient } = await import('../src/remediation.js');
const { aggregateDashboard } = await import('../src/waste.js');
const { getRunsForRepo } = await import('../src/db.js');

// Seed the fixture data once
seedFromFixtures(fixtures);

const repos = getRepos();
assert.equal(repos.length, 3, 'fixture seeds 3 repos');

test('health check', async () => {
  const { createServer } = await import('../src/server.js');
  const app = createServer();
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, 'ok');
  server.close();
});

test('acceptance 1: fixture dashboard lists each waste category with recoverable minutes and shows top wasteful workflow per repo', () => {
  // Analyze all repos
  const dashboards = repos.map(r => analyzeRepo(r, {}));
  // Global categories present with recoverable minutes (some may be 0 but present)
  const globalCategories = ['superseded','push_pr_duplicate','zombie_cron','flaky_job','missing_timeout'];
  for (const d of dashboards) {
    assert.ok(d.categories, 'categories present');
    for (const k of globalCategories) {
      assert.ok(k in d.categories, `category ${k} present in dashboard`);
      assert.ok(typeof d.categories[k].recoverable_minutes === 'number', `${k} recoverable_minutes is a number`);
    }
    // top wasteful workflow per repo: either a workflow with recoverable_minutes>0 or null if clean
    if (d.has_waste && d.total_recoverable_minutes > 0) {
      assert.ok(d.top_wasteful_workflow, 'top wasteful workflow present for wasteful repo');
      assert.ok(d.top_wasteful_workflow.recoverable_minutes > 0, 'top wasteful workflow has positive recoverable minutes');
    } else {
      assert.equal(d.top_wasteful_workflow, null, 'clean repo has no top wasteful workflow');
      assert.equal(d.total_recoverable_minutes, 0, 'clean repo has zero recoverable minutes');
    }
  }

  // Specifically verify acme/agent-app has waste (superseded + push_pr_duplicate + zombie_cron + flaky_job)
  const agentApp = dashboards.find(d => d.repo.full_name === 'acme/agent-app');
  assert.ok(agentApp.total_recoverable_minutes > 0, 'acme/agent-app has recoverable minutes');
  assert.ok(agentApp.categories.superseded.recoverable_minutes > 0, 'superseded minutes > 0');
  assert.ok(agentApp.categories.push_pr_duplicate.recoverable_minutes > 0, 'push_pr_duplicate minutes > 0');
  assert.ok(agentApp.categories.zombie_cron.recoverable_minutes > 0, 'zombie_cron minutes > 0');
  assert.ok(agentApp.categories.flaky_job.recoverable_minutes > 0, 'flaky_job minutes > 0');
  assert.ok(agentApp.top_wasteful_workflow, 'top wasteful workflow shown');

  // acme/tools has some waste (push_pr_duplicate) and missing_timeout
  const tools = dashboards.find(d => d.repo.full_name === 'acme/tools');
  assert.ok(tools.total_recoverable_minutes > 0, 'acme/tools has recoverable minutes');

  // acme/stable-lib is clean
  const stable = dashboards.find(d => d.repo.full_name === 'acme/stable-lib');
  assert.equal(stable.total_recoverable_minutes, 0, 'acme/stable-lib has zero recoverable minutes');
  assert.equal(stable.top_wasteful_workflow, null, 'acme/stable-lib has no top wasteful workflow');
});

test('acceptance 2 (failure case): a repo with no wasteful patterns shows zero recoverable minutes and no false-positive remediation PRs', async () => {
  const stable = repos.find(r => `${r.owner}/${r.name}` === 'acme/stable-lib');
  assert.ok(stable, 'stable-lib repo exists');
  analyzeRepo(stable, {});
  const findings = getFindings(stable.id);
  assert.equal(findings.length, 0, 'no waste findings for clean repo');

  const client = new GitHubClient({ mode: 'dry-run' });
  const remediations = await remediateRepo(stable.id, client);
  assert.equal(remediations.length, 0, 'no remediation PRs for clean repo (no false positives)');
});

test('acceptance 3: for a repo missing concurrency cancellation, system opens a PR adding the concurrency block and reports estimated minutes saved', async () => {
  const agentApp = repos.find(r => `${r.owner}/${r.name}` === 'acme/agent-app');
  assert.ok(agentApp, 'acme/agent-app exists');
  analyzeRepo(agentApp, {});
  const findings = getFindings(agentApp.id);
  const superseded = findings.filter(f => f.category === 'superseded');
  assert.ok(superseded.length > 0, 'agent-app has superseded runs');

  const client = new GitHubClient({ mode: 'dry-run' });
  const remediations = await remediateRepo(agentApp.id, client);
  assert.ok(remediations.length >= 1, 'at least one remediation PR generated');
  const concurrency = remediations.find(r => r.category === 'concurrency');
  assert.ok(concurrency, 'concurrency remediation PR present');
  assert.match(concurrency.title, /concurrency/i, 'PR title mentions concurrency');
  assert.match(concurrency.diff, /concurrency:/, 'diff adds a concurrency block');
  assert.ok(concurrency.estimated_minutes_saved > 0, 'reports estimated minutes saved');
  assert.ok(concurrency.pr_url, 'PR record includes a URL (fixture)');
});

test.after(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});