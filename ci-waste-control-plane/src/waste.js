// @ts-check
/**
 * Waste categorization engine.
 * Categories:
 * - superseded: non-latest run on same (workflow_id, head_branch) for PR/push sequences; recoverable = its duration
 * - push_pr_duplicate: a push run and a pull_request run for the same head_sha and workflow within window; keep PR run, mark push run duplicate
 * - zombie_cron: schedule-triggered workflow with 0 successful conclusions in last staleCronDays while runs exist
 * - flaky_job: workflow with >=2 attempts for same run id OR re-run pattern: same workflow+head_sha failing then passing within window (retry-proven)
 * - missing_timeout: run/workflow has no timeout-minutes configured (has_timeout=false)
 */

export function categorizeWaste(repo, runs, opts = {}) {
  const staleCronDays = opts.staleCronDays ?? 7;
  const findings = [];
  const now = opts.now ? new Date(opts.now) : new Date(Math.max(...runs.map(r => new Date(r.updated_at || r.created_at).getTime()), Date.now()));

  // --- superseded runs ---
  // group by workflow_id + head_branch for push/pull_request events
  const branchGroups = new Map();
  for (const r of runs) {
    if (!r.head_branch || (r.event !== 'push' && r.event !== 'pull_request')) continue;
    const key = `${r.workflow_id}::${r.head_branch}`;
    if (!branchGroups.has(key)) branchGroups.set(key, []);
    branchGroups.get(key).push(r);
  }
  for (const [, group] of branchGroups) {
    group.sort((a,b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
    // all but the latest are superseded if a later run exists (completed or not - superseded means replaced)
    for (let i = 0; i < group.length - 1; i++) {
      const r = group[i];
      findings.push({
        repo_id: repo.id, run_id: r.id, workflow_name: r.workflow_name,
        category: 'superseded',
        recoverable_minutes: r.duration_minutes || 0,
        detail: `Run #${r.run_number} on ${r.head_branch} superseded by later run in ${r.workflow_name}`,
      });
    }
  }

  // --- push+PR duplicates (same commit runs twice) ---
  // group by head_sha + workflow_id across push and pull_request
  const shaGroups = new Map();
  for (const r of runs) {
    if (!r.head_sha) continue;
    if (r.event !== 'push' && r.event !== 'pull_request') continue;
    const key = `${r.workflow_id}::${r.head_sha}`;
    if (!shaGroups.has(key)) shaGroups.set(key, []);
    shaGroups.get(key).push(r);
  }
  for (const [, group] of shaGroups) {
    const hasPush = group.some(r => r.event === 'push');
    const hasPr = group.some(r => r.event === 'pull_request');
    if (hasPush && hasPr) {
      // mark push runs as duplicate (PR run is the canonical one)
      for (const r of group.filter(r => r.event === 'push')) {
        // avoid double-counting with superseded? push_pr_duplicate is its own category; record separately
        findings.push({
          repo_id: repo.id, run_id: r.id, workflow_name: r.workflow_name,
          category: 'push_pr_duplicate',
          recoverable_minutes: r.duration_minutes || 0,
          detail: `Push run #${r.run_number} duplicates pull_request run for same commit ${String(r.head_sha).slice(0,7)} in ${r.workflow_name}`,
        });
      }
    }
  }

  // --- zombie crons ---
  // schedule workflows: if all schedule runs in window failed or none successful recently and it's been staleCronDays since last success
  const schedByWorkflow = new Map();
  for (const r of runs) {
    if (r.event !== 'schedule') continue;
    if (!schedByWorkflow.has(r.workflow_id)) schedByWorkflow.set(r.workflow_id, { name: r.workflow_name, runs: [] });
    schedByWorkflow.get(r.workflow_id).runs.push(r);
  }
  for (const [, w] of schedByWorkflow) {
    const successes = w.runs.filter(r => r.conclusion === 'success');
    const lastSuccess = successes.length ? Math.max(...successes.map(r => new Date(r.updated_at || r.created_at).getTime())) : null;
    const staleMs = staleCronDays * 24 * 60 * 60 * 1000;
    const isStale = lastSuccess === null ? true : (now.getTime() - lastSuccess) > staleMs;
    if (isStale && w.runs.length > 0) {
      // estimate recoverable as sum of durations in stale window (recent runs that are wasted)
      const staleRuns = w.runs.filter(r => lastSuccess === null || new Date(r.created_at).getTime() > lastSuccess);
      const recoverable = staleRuns.reduce((s, r) => s + (r.duration_minutes || 0), 0);
      findings.push({
        repo_id: repo.id, run_id: null, workflow_name: w.name,
        category: 'zombie_cron',
        recoverable_minutes: recoverable,
        detail: `Scheduled workflow "${w.name}" has no successful runs in last ${staleCronDays} days (${w.runs.length} runs, ${staleRuns.length} since last success)`,
      });
    }
  }

  // --- flaky jobs (retry-proven) ---
  // Pattern 2 (retry-proven) takes precedence: same workflow+head_sha has failure then success on the same commit.
  // Pattern 1 (attempt > 1) is a fallback flag for workflows not already flagged by pattern 2, and only counts
  // failed attempts (conclusion === 'failure') so a successful retry's duration is not double-counted.
  const flakyWorkflows = new Map();
  const shaOutcome = new Map();
  for (const r of runs) {
    if (!r.head_sha) continue;
    const key = `${r.workflow_id}::${r.head_sha}`;
    if (!shaOutcome.has(key)) shaOutcome.set(key, { name: r.workflow_name, runs: [] });
    shaOutcome.get(key).runs.push(r);
  }
  for (const [, g] of shaOutcome) {
    const conclusions = g.runs.map(r => r.conclusion).filter(Boolean);
    if (conclusions.includes('failure') && conclusions.includes('success') && g.runs.length >= 2) {
      if (!flakyWorkflows.has(g.runs[0].workflow_id)) flakyWorkflows.set(g.runs[0].workflow_id, { name: g.name, minutes: 0, reasons: new Set() });
      const w = flakyWorkflows.get(g.runs[0].workflow_id);
      // recoverable = failed attempts' duration only
      for (const r of g.runs.filter(r => r.conclusion === 'failure')) w.minutes += r.duration_minutes || 0;
      w.reasons.add(`retry-proven: failure then success on ${String(g.runs[0].head_sha).slice(0,7)}`);
    }
  }
  // Fallback: workflows with retried runs (attempt > 1) not already flagged by pattern 2 above.
  for (const r of runs) {
    if ((r.attempt || 1) > 1 && !flakyWorkflows.has(r.workflow_id) && r.conclusion === 'failure') {
      flakyWorkflows.set(r.workflow_id, { name: r.workflow_name, minutes: 0, reasons: new Set() });
      const w = flakyWorkflows.get(r.workflow_id);
      w.minutes += r.duration_minutes || 0;
      w.reasons.add(`attempt ${r.attempt} on run #${r.run_number}`);
    }
  }
  for (const [, w] of flakyWorkflows) {
    findings.push({
      repo_id: repo.id, run_id: null, workflow_name: w.name,
      category: 'flaky_job',
      recoverable_minutes: w.minutes,
      detail: `Flaky workflow "${w.name}": ${Array.from(w.reasons).join('; ')}`,
    });
  }

  // --- missing timeouts ---
  // any run with has_timeout false indicates workflow/job missing timeout-minutes
  const noTimeoutWorkflows = new Map();
  for (const r of runs) {
    if (r.has_timeout === 0 || r.has_timeout === false) {
      if (!noTimeoutWorkflows.has(r.workflow_id)) noTimeoutWorkflows.set(r.workflow_id, { name: r.workflow_name, runs: 0, minutes: 0 });
      const w = noTimeoutWorkflows.get(r.workflow_id);
      w.runs++;
      // recoverable estimate: portion of runtime that could be capped; conservative: 0 direct recoverable but flagged (we report 0 recoverable minutes? better give a small estimate based on long runs)
      w.minutes += 0;
    }
  }
  for (const [, w] of noTimeoutWorkflows) {
    findings.push({
      repo_id: repo.id, run_id: null, workflow_name: w.name,
      category: 'missing_timeout',
      recoverable_minutes: w.minutes,
      detail: `Workflow "${w.name}" is missing timeout-minutes (${w.runs} runs observed without timeout)`,
    });
  }

  return findings;
}

export function aggregateDashboard(repo, runs, findings) {
  const categories = {
    superseded: { label: 'Superseded runs', recoverable_minutes: 0, count: 0 },
    push_pr_duplicate: { label: 'Push + PR duplicates', recoverable_minutes: 0, count: 0 },
    zombie_cron: { label: 'Zombie crons', recoverable_minutes: 0, count: 0 },
    flaky_job: { label: 'Flaky jobs', recoverable_minutes: 0, count: 0 },
    missing_timeout: { label: 'Missing timeouts', recoverable_minutes: 0, count: 0 },
  };
  for (const f of findings) {
    if (!categories[f.category]) categories[f.category] = { label: f.category, recoverable_minutes: 0, count: 0 };
    categories[f.category].recoverable_minutes += f.recoverable_minutes || 0;
    categories[f.category].count += 1;
  }
  // round
  for (const c of Object.values(categories)) c.recoverable_minutes = Math.round(c.recoverable_minutes * 100) / 100;

  // per-workflow cost and waste
  const byWorkflow = new Map();
  for (const r of runs) {
    if (!byWorkflow.has(r.workflow_name)) byWorkflow.set(r.workflow_name, { workflow_name: r.workflow_name, total_minutes: 0, runs: 0, recoverable_minutes: 0 });
    const w = byWorkflow.get(r.workflow_name);
    w.total_minutes += r.duration_minutes || 0;
    w.runs++;
  }
  for (const f of findings) {
    if (f.workflow_name && byWorkflow.has(f.workflow_name)) {
      byWorkflow.get(f.workflow_name).recoverable_minutes += f.recoverable_minutes || 0;
    }
  }
  const workflows = Array.from(byWorkflow.values()).map(w => ({
    ...w,
    total_minutes: Math.round(w.total_minutes * 100) / 100,
    recoverable_minutes: Math.round(w.recoverable_minutes * 100) / 100,
  })).sort((a,b) => b.recoverable_minutes - a.recoverable_minutes || b.total_minutes - a.total_minutes);

  const total_recoverable = Math.round(workflows.reduce((s,w)=>s+w.recoverable_minutes,0)*100)/100;
  const top_wasteful_workflow = workflows.find(w => w.recoverable_minutes > 0) || null;

  return {
    repo: { id: repo.id, owner: repo.owner, name: repo.name, full_name: `${repo.owner}/${repo.name}` },
    categories,
    workflows,
    top_wasteful_workflow,
    total_recoverable_minutes: total_recoverable,
    total_runs: runs.length,
    has_waste: total_recoverable > 0 || findings.some(f => f.category === 'missing_timeout'),
  };
}