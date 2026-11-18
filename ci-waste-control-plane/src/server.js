// @ts-check
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getRepos, getRepoById, getRunsForRepo, getFindings, getRemediations, resetAll } from './db.js';
import { ensureSeeded } from './seed.js';
import { analyzeRepo } from './remediation.js';
import { remediateRepo, GitHubClient } from './remediation.js';
import { aggregateDashboard } from './waste.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  ensureSeeded();

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'ci-waste-control-plane' }));

  app.get('/api/repos', (_req, res) => {
    const repos = getRepos();
    const out = repos.map(r => {
      const runs = getRunsForRepo(r.id);
      const findings = getFindings(r.id);
      const dashboard = aggregateDashboard(r, runs, findings);
      return { ...r, total_runs: runs.length, total_recoverable_minutes: dashboard.total_recoverable_minutes, has_waste: dashboard.has_waste };
    });
    res.json(out);
  });

  app.get('/api/repos/:id', (req, res) => {
    const repo = getRepoById(Number(req.params.id));
    if (!repo) return res.status(404).json({ error: 'repo not found' });
    const runs = getRunsForRepo(repo.id);
    const findings = getFindings(repo.id);
    if (findings.length === 0) analyzeRepo(repo, {});
    const fresh = getFindings(repo.id);
    const dashboard = aggregateDashboard(repo, runs, fresh);
    res.json({ repo, dashboard, findings: fresh });
  });

  app.get('/api/repos/:id/waste', (req, res) => {
    const repo = getRepoById(Number(req.params.id));
    if (!repo) return res.status(404).json({ error: 'repo not found' });
    const runs = getRunsForRepo(repo.id);
    const findings = getFindings(repo.id);
    const dashboard = aggregateDashboard(repo, runs, findings);
    res.json({ repo: { id: repo.id, owner: repo.owner, name: repo.name }, dashboard, findings });
  });

  app.post('/api/repos/:id/analyze', (req, res) => {
    const repo = getRepoById(Number(req.params.id));
    if (!repo) return res.status(404).json({ error: 'repo not found' });
    const dashboard = analyzeRepo(repo, req.body || {});
    res.json({ repo: { id: repo.id, owner: repo.owner, name: repo.name }, dashboard, findings: getFindings(repo.id) });
  });

  app.get('/api/dashboard', (_req, res) => {
    const repos = getRepos();
    const repoDashboards = repos.map(r => {
      const runs = getRunsForRepo(r.id);
      const findings = getFindings(r.id);
      if (findings.length === 0) analyzeRepo(r, {});
      const fresh = getFindings(r.id);
      return aggregateDashboard(r, runs, fresh);
    });
    // global categories
    const globalCats = { superseded: 0, push_pr_duplicate: 0, zombie_cron: 0, flaky_job: 0, missing_timeout: 0 };
    for (const d of repoDashboards) {
      for (const [k, v] of Object.entries(d.categories)) {
        globalCats[k] = (globalCats[k] || 0) + (v.recoverable_minutes || 0);
      }
    }
    const total_recoverable = Math.round(Object.values(globalCats).reduce((s,v)=>s+v,0)*100)/100;
    const top_repos = repoDashboards.map(d => ({
      repo: d.repo, total_recoverable_minutes: d.total_recoverable_minutes,
      top_wasteful_workflow: d.top_wasteful_workflow,
      has_waste: d.has_waste,
    })).sort((a,b) => b.total_recoverable_minutes - a.total_recoverable_minutes);
    res.json({
      total_recoverable_minutes: total_recoverable,
      categories: globalCats,
      repos: top_repos,
      repo_dashboards: repoDashboards,
    });
  });

  app.post('/api/repos/:id/remediate', async (req, res) => {
    const repo = getRepoById(Number(req.params.id));
    if (!repo) return res.status(404).json({ error: 'repo not found' });
    // ensure findings exist
    if (getFindings(repo.id).length === 0) analyzeRepo(repo, {});
    const client = new GitHubClient({ mode: req.body?.mode || 'dry-run' });
    const results = await remediateRepo(repo.id, client);
    res.json({ repo: { id: repo.id, owner: repo.owner, name: repo.name }, remediations: results });
  });

  app.get('/api/remediations', (req, res) => {
    const repos = getRepos();
    const all = [];
    for (const r of repos) {
      for (const pr of getRemediations(r.id)) {
        all.push({ ...pr, repo: `${r.owner}/${r.name}` });
      }
    }
    res.json(all);
  });

  app.post('/api/reset', (_req, res) => {
    resetAll();
    try { ensureSeeded(); } catch {}
    res.json({ status: 'ok' });
  });

  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = createServer();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`ci-waste-control-plane listening on http://localhost:${port}`));
}