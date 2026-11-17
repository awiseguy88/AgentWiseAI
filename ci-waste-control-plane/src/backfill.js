// @ts-check
/**
 * Backfill last 100 workflow runs per repo via GitHub REST API.
 * Stores normalized run records via db.insertRun.
 */
import { insertRun } from './db.js';

export async function backfillRuns(repo, { token, apiBase = 'https://api.github.com', limit = 100 } = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token || process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${token || process.env.GITHUB_TOKEN}`;
  const url = `${apiBase}/repos/${repo.owner}/${repo.name}/actions/runs?per_page=${Math.min(limit,100)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const runs = (json.workflow_runs || []).slice(0, limit).map(r => normalizeRun(r));
  for (const run of runs) insertRun(repo.id, run);
  return { count: runs.length };
}

export function normalizeRun(r) {
  const created = r.created_at ? new Date(r.created_at).getTime() : 0;
  const updated = r.updated_at ? new Date(r.updated_at).getTime() : created;
  const duration_minutes = created && updated ? Math.max(0, (updated - created) / 60000) : 0;
  return {
    id: r.id,
    workflow_id: r.workflow_id,
    workflow_name: r.name || r.workflow_name || 'Workflow',
    run_number: r.run_number,
    event: r.event,
    status: r.status,
    conclusion: r.conclusion,
    head_branch: r.head_branch,
    head_sha: r.head_sha,
    attempt: r.run_attempt || 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
    run_started_at: r.run_started_at,
    duration_minutes,
    // has_timeout: GitHub API doesn't expose per-run timeout; infer false if we know from workflow; default true (conservative)
    has_timeout: r.has_timeout !== undefined ? r.has_timeout : true,
  };
}