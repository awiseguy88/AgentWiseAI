import { NormalizedRun, RunAnalysis, StepCost } from "./types.js";
import { resolveCost } from "./pricing.js";

export function analyzeRun(run: NormalizedRun): RunAnalysis {
  const steps: StepCost[] = run.steps.map((s) => ({
    step: s.step,
    model: s.model ?? run.model,
    model_version: s.model_version ?? run.model_version,
    input_tokens: s.input_tokens,
    output_tokens: s.output_tokens,
    cost_usd: resolveCost({ ...s, model: s.model ?? run.model }),
    latency_ms: s.latency_ms,
    message_index: s.message_index,
    status: s.status,
    upstream: s.upstream,
    intended: s.intended,
  }));

  const total_cost_usd = steps.reduce((a, b) => a + b.cost_usd, 0);
  const total_latency_ms = steps.reduce((a, b) => a + b.latency_ms, 0);
  const total_input_tokens = steps.reduce((a, b) => a + b.input_tokens, 0);
  const total_output_tokens = steps.reduce((a, b) => a + b.output_tokens, 0);

  // Retry-loop / call inflation detection
  const intendedMarked = run.steps.filter((s) => s.intended).length;
  const intended_calls = run.intended_steps ?? (intendedMarked > 0 ? intendedMarked : 0);
  const actual_calls = run.steps.length;
  const amplification = intended_calls > 0 ? actual_calls / intended_calls : 1;
  const inflated = intended_calls > 0 && actual_calls > intended_calls * 2 && actual_calls - intended_calls >= 4;

  // Find the looping step (most repeated step name among excess)
  let looping_step: string | undefined;
  if (inflated) {
    const counts = new Map<string, number>();
    for (const s of run.steps) counts.set(s.step, (counts.get(s.step) ?? 0) + 1);
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length) looping_step = entries[0][0];
  }

  // Context creep: ratio of last (or 50th/indexed) message cost to first
  const byIndex = steps
    .filter((s) => s.message_index != null)
    .sort((a, b) => (a.message_index! - b.message_index!));
  const first = byIndex.length ? byIndex[0] : steps[0];
  const last = byIndex.length ? byIndex[byIndex.length - 1] : steps[steps.length - 1];
  const first_cost_usd = first?.cost_usd ?? 0;
  const last_cost_usd = last?.cost_usd ?? 0;
  const ratio = first_cost_usd > 0 ? last_cost_usd / first_cost_usd : (last_cost_usd > 0 ? Infinity : 1);
  const flagged = ratio >= 5;

  const verdict_reasons: string[] = [];
  if (inflated) verdict_reasons.push(`retry loop: ${looping_step ?? "step"} (${actual_calls} actual vs ${intended_calls} intended)`);
  if (flagged) verdict_reasons.push(`context creep: ${ratio.toFixed(1)}x last/first message cost`);
  if (run.unversioned) verdict_reasons.push("unversioned model (excluded from drift comparison)");
  const verdict: "keep" | "investigate" = verdict_reasons.some((r) => r.includes("retry") || r.includes("creep")) ? "investigate" : "keep";

  return {
    run_id: run.run_id,
    workflow: run.workflow,
    customer: run.customer,
    model: run.model,
    model_version: run.model_version,
    unversioned: run.unversioned,
    total_cost_usd,
    total_latency_ms,
    total_input_tokens,
    total_output_tokens,
    step_count: actual_calls,
    intended_step_count: intended_calls,
    steps,
    retry: { inflated, intended_calls, actual_calls, looping_step, amplification },
    context_creep: { ratio, first_cost_usd, last_cost_usd, flagged },
    verdict,
    verdict_reasons,
  };
}