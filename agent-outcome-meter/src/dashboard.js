import { query } from './db.js';
import { round2 } from './pricing.js';

export async function mergedPrCosts() {
  const rows = await query(
    `SELECT repo, pr_number, model, turn,
            SUM(cost_usd) AS cost,
            SUM(prompt_tokens) AS prompt_tokens,
            SUM(completion_tokens) AS completion_tokens,
            COUNT(*) AS events
     FROM runs
     WHERE accepted = 1 AND pr_number IS NOT NULL
     GROUP BY repo, pr_number, model, turn
     ORDER BY repo, pr_number, model, turn`,
  );
  const byPr = new Map();
  for (const r of rows) {
    const key = `${r.repo}#${r.pr_number}`;
    if (!byPr.has(key)) {
      byPr.set(key, {
        repo: r.repo,
        pr_number: Number(r.pr_number),
        total_cost_usd: 0,
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_events: 0,
        by_model: {},
        by_turn: {},
      });
    }
    const pr = byPr.get(key);
    const model = r.model;
    const turn = Number(r.turn);
    const cost = Number(r.cost);
    pr.total_cost_usd += cost;
    pr.total_prompt_tokens += Number(r.prompt_tokens);
    pr.total_completion_tokens += Number(r.completion_tokens);
    pr.total_events += Number(r.events);
    if (!pr.by_model[model]) pr.by_model[model] = { cost_usd: 0, events: 0 };
    pr.by_model[model].cost_usd += cost;
    pr.by_model[model].events += Number(r.events);
    if (!pr.by_turn[turn]) pr.by_turn[turn] = { cost_usd: 0, events: 0 };
    pr.by_turn[turn].cost_usd += cost;
    pr.by_turn[turn].events += Number(r.events);
  }
  const prs = [...byPr.values()].map((pr) => ({
    repo: pr.repo,
    pr_number: pr.pr_number,
    total_cost_usd: round2(pr.total_cost_usd),
    total_prompt_tokens: pr.total_prompt_tokens,
    total_completion_tokens: pr.total_completion_tokens,
    total_events: pr.total_events,
    by_model: Object.fromEntries(
      Object.entries(pr.by_model).map(([m, v]) => [m, { cost_usd: round2(v.cost_usd), events: v.events }]),
    ),
    by_turn: Object.fromEntries(
      Object.entries(pr.by_turn).map(([t, v]) => [t, { cost_usd: round2(v.cost_usd), events: v.events }]),
    ),
  }));
  return { count: prs.length, pull_requests: prs };
}

export async function totalSpend() {
  const row = (await query(
    `SELECT
       COALESCE(SUM(cost_usd), 0) AS total,
       COALESCE(SUM(CASE WHEN accepted = 1 THEN cost_usd ELSE 0 END), 0) AS accepted,
       COALESCE(SUM(CASE WHEN failed = 1 AND merged = 0 THEN cost_usd ELSE 0 END), 0) AS failed,
       COUNT(*) AS total_events
     FROM runs`,
  ))[0] || {};
  const prRow = (await query(
    `SELECT COUNT(DISTINCT repo || '#' || pr_number) AS n FROM runs WHERE accepted = 1 AND pr_number IS NOT NULL`,
  ))[0] || {};
  const total = Number(row.total) || 0;
  const accepted = Number(row.accepted) || 0;
  const failed = Number(row.failed) || 0;
  const mergedPrCount = Number(prRow.n) || 0;
  return {
    total_spend_usd: round2(total),
    accepted_spend_usd: round2(accepted),
    failed_spend_usd: round2(failed),
    merged_pr_count: mergedPrCount,
    cost_per_accepted_outcome_usd: mergedPrCount > 0 ? round2(accepted / mergedPrCount) : null,
    total_events: Number(row.total_events) || 0,
  };
}

export async function listRuns(filters = {}) {
  const where = [];
  const params = [];
  if (filters.engineer_id) {
    params.push(filters.engineer_id);
    where.push(`engineer_id = $${params.length}`);
  }
  if (filters.team_id) {
    params.push(filters.team_id);
    where.push(`team_id = $${params.length}`);
  }
  const sql = `SELECT id, task_id, repo, pr_number, engineer_id, team_id, model, prompt_tokens,
                      completion_tokens, total_tokens, cost_usd, turn, merged, failed, created_at
               FROM runs ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY id DESC LIMIT 200`;
  return query(sql, params);
}
