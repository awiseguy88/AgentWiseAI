import { run } from './db.js';
import { modelPrice, usageCost } from './pricing.js';

/**
 * Normalize an incoming usage event into the canonical run row shape.
 * Accepts both the flat LiteLLM instrumentation shape and a nested
 * { usage: { prompt_tokens, completion_tokens }, metadata: { ... } } shape
 * so a LiteLLM proxy logger plugin can forward raw callbacks unchanged.
 */
export function normalizeEvent(raw, prices, defaults = {}) {
  const usage = raw.usage || {};
  const meta = raw.metadata || {};
  const promptTokens = Number(raw.prompt_tokens ?? usage.prompt_tokens ?? 0) || 0;
  const completionTokens = Number(raw.completion_tokens ?? usage.completion_tokens ?? 0) || 0;
  const totalTokens = Number(raw.total_tokens ?? usage.total_tokens ?? promptTokens + completionTokens) || 0;
  const model = String(raw.model || meta.model || '');
  const taskId = String(raw.task_id ?? meta.task_id ?? '');
  const repo = String(raw.repo ?? meta.repo ?? defaults.repo ?? '');
  const prNumber =
    raw.pr_number !== undefined && raw.pr_number !== null
      ? Number(raw.pr_number)
      : meta.pr_number !== undefined && meta.pr_number !== null
        ? Number(meta.pr_number)
        : null;
  const engineerId = String(raw.engineer_id ?? meta.engineer_id ?? defaults.engineer_id ?? 'anonymous');
  const teamId = String(raw.team_id ?? meta.team_id ?? defaults.team_id ?? 'default');
  const sessionId = raw.session_id ?? meta.session_id ?? null;
  const turn = Number(raw.turn ?? meta.turn ?? 1) || 1;
  const cost = usageCost(model, promptTokens, completionTokens, prices);
  const rateCard = JSON.stringify(modelPrice(prices, model));
  return {
    task_id: taskId,
    session_id: sessionId,
    repo,
    pr_number: Number.isFinite(prNumber) ? prNumber : null,
    engineer_id: engineerId,
    team_id: teamId,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost_usd: cost,
    rate_card: rateCard,
    turn,
    source: raw.source || 'litellm',
  };
}

export async function recordUsage(events, prices, defaults = {}) {
  const list = Array.isArray(events) ? events : [events];
  if (list.length === 0) return { inserted: 0, total_cost: 0, url: null };
  const inserted = [];
  for (const raw of list) {
    const n = normalizeEvent(raw, prices, defaults);
    if (!n.task_id) throw new Error('task_id is required on every usage event');
    if (!n.repo) throw new Error('repo is required on every usage event');
    if (!n.model) throw new Error('model is required on every usage event');
    await run(
      `INSERT INTO runs (task_id, session_id, repo, pr_number, engineer_id, team_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, rate_card, turn, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        n.task_id, n.session_id, n.repo, n.pr_number, n.engineer_id, n.team_id,
        n.model, n.prompt_tokens, n.completion_tokens, n.total_tokens,
        n.cost_usd, n.rate_card, n.turn, n.source,
      ],
    );
    inserted.push(n);
  }
  const totalCost = inserted.reduce((s, n) => s + n.cost_usd, 0);
  return { inserted: inserted.length, total_cost: totalCost, url: null };
}
