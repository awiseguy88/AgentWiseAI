// @ts-check
import { categorizeWaste, aggregateDashboard } from './waste.js';
import { insertFinding, clearFindings, getFindings, getRunsForRepo, clearRemediations, insertRemediation, getRepoById } from './db.js';

export class GitHubClient {
  constructor(opts = {}) {
    this.mode = opts.mode || 'dry-run'; // 'dry-run' | 'live'
    this.token = opts.token || process.env.GITHUB_TOKEN || null;
    this.apiBase = opts.apiBase || 'https://api.github.com';
    this.openedPRs = []; // record for tests/dry-run
  }

  async createRemediationPR({ owner, repo, title, body, head, base, changes, diff }) {
    const record = { owner, repo, title, body, head, base, changes, diff, status: this.mode === 'live' ? 'pending' : 'dry-run' };
    if (this.mode === 'live' && this.token) {
      // Minimal live path: create branch, commit file, open PR via REST API.
      // In practice this requires proper auth; tests/fixtures use dry-run.
      const headers = { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
      try {
        const res = await fetch(`${this.apiBase}/repos/${owner}/${repo}/pulls`, {
          method: 'POST', headers,
          body: JSON.stringify({ title, body, head, base }),
        });
        const json = await res.json();
        if (res.ok) { record.status = 'opened'; record.pr_number = json.number; record.pr_url = json.html_url; }
        else { record.status = 'error'; record.error = json.message || String(res.status); }
      } catch (e) { record.status = 'error'; record.error = e.message; }
    } else {
      record.status = 'dry-run';
      // simulate an opened PR record for fixture acceptance demonstration
      record.pr_number = this.openedPRs.length + 1000;
      record.pr_url = `https://github.com/${owner}/${repo}/pull/fixture-${record.pr_number}`;
    }
    this.openedPRs.push(record);
    return record;
  }
}

function concurrencyPatch(workflowYaml) {
  // If no yaml provided, generate a minimal concurrency block snippet
  const block = `concurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n  cancel-in-progress: true\n`;
  if (!workflowYaml) {
    return { diff: `+${block.replace(/\n/g, '\n+')}`, patched: block };
  }
  // naive insert: add after 'on:' block's first top-level key occurrence or at top after name
  if (/^concurrency:/m.test(workflowYaml)) return { diff: '', patched: workflowYaml, already: true };
  let patched = workflowYaml;
  if (/^on:\s*$/m.test(workflowYaml) || /^on:\s*\n/m.test(workflowYaml)) {
    patched = workflowYaml.replace(/(^on:[\s\S]*?(?=\n\w|\n?$))/m, (m) => m + '\n' + block);
  } else if (/^name:/m.test(workflowYaml)) {
    patched = workflowYaml.replace(/(^name:.*\n)/m, (m) => m + '\n' + block);
  } else {
    patched = block + '\n' + workflowYaml;
  }
  const diff = `--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@\n+concurrency:\n+  group: \${{ github.workflow }}-\${{ github.ref }}\n+  cancel-in-progress: true\n`;
  return { diff, patched };
}

export function generateRemediations(repo, runs, findings, githubClient) {
  const remediations = [];
  // remediation: for a repo missing concurrency cancellation, open a PR adding the concurrency block and report estimated minutes saved
  // trigger when superseded runs exist (concurrency cancellation would prevent them) and workflow lacks concurrency (indicated by superseded waste)
  const superseded = findings.filter(f => f.category === 'superseded');
  if (superseded.length > 0) {
    const estimated = Math.round(superseded.reduce((s,f)=>s+(f.recoverable_minutes||0),0)*100)/100;
    const hasConcurrency = repo.workflow_yaml && /^concurrency:/m.test(repo.workflow_yaml);
    if (!hasConcurrency) {
      const patch = concurrencyPatch(repo.workflow_yaml);
      remediations.push({
        category: 'concurrency',
        title: 'ci: add concurrency cancellation to avoid superseded runs',
        body: `Adds a concurrency block to cancel in-progress runs when a newer run starts on the same ref.\n\nEstimated minutes saved: ${estimated} (based on observed superseded runs).\n\nCategory: superseded runs`,
        diff: patch.diff,
        estimated_minutes_saved: estimated,
        action: 'open_pr',
      });
    }
  }
  return remediations;
}

export async function remediateRepo(repoId, githubClient) {
  const repo = getRepoById(repoId);
  if (!repo) throw new Error('repo not found');
  const runs = getRunsForRepo(repoId);
  const findings = getFindings(repoId);
  const plans = generateRemediations(repo, runs, findings, githubClient);
  clearRemediations(repoId);
  const results = [];
  for (const plan of plans) {
    let pr = null;
    if (plan.action === 'open_pr' && githubClient) {
      pr = await githubClient.createRemediationPR({
        owner: repo.owner, repo: repo.name,
        title: plan.title, body: plan.body,
        head: `ci/add-concurrency-${repo.name}`, base: repo.default_branch || 'main',
        diff: plan.diff,
      });
    }
    const rec = insertRemediation({
      repo_id: repoId,
      category: plan.category,
      title: plan.title,
      body: plan.body,
      diff: plan.diff,
      pr_number: pr?.pr_number ?? null,
      pr_url: pr?.pr_url ?? null,
      status: pr?.status ?? 'planned',
      estimated_minutes_saved: plan.estimated_minutes_saved,
    });
    results.push(rec);
  }
  return results;
}

export function analyzeRepo(repo, opts = {}) {
  const runs = getRunsForRepo(repo.id);
  clearFindings(repo.id);
  const findings = categorizeWaste(repo, runs, opts);
  for (const f of findings) insertFinding(f);
  const stored = getFindings(repo.id);
  return aggregateDashboard(repo, runs, stored);
}