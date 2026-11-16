// Core data model for the Agent Production Run Cockpit.
//
// Ingested log format (JSONL): one object per line, each describing either a
// run header or a step event. Runs and steps are normalized into the structures
// below so downstream analysis (cost breakdown, retry-loop detection, context
// creep, drift comparison, attribution, budget caps) is schema-stable.

export interface StepRecord {
  /** Stable step identifier within the run. */
  step: string;
  /** Model identifier used for this step (may be absent). */
  model?: string;
  /** Provider model version tag (e.g. "gpt-4o-2024-08-06"). Absent => unversioned. */
  model_version?: string;
  /** Input/prompt tokens billed for this step. */
  input_tokens: number;
  /** Output/completion tokens billed for this step. */
  output_tokens: number;
  /** Optional explicit cost in USD; overrides computed pricing when present. */
  cost_usd?: number;
  /** Latency for this step in milliseconds. */
  latency_ms: number;
  /** Wall-clock timestamp (ISO) for this step. */
  ts?: string;
  /** Position of this step's message in the run thread (1-based). */
  message_index?: number;
  /** Status of the step: ok | error | retried. */
  status?: string;
  /** Upstream/target of the step (API name, tool name, etc.). */
  upstream?: string;
  /** Whether this step was an intended (planned) step. */
  intended?: boolean;
  /** Workflow this step/run belongs to (attribution). */
  workflow?: string;
  /** Customer/tenant this step/run belongs to (attribution). */
  customer?: string;
}

export interface RunHeader {
  run_id: string;
  workflow?: string;
  customer?: string;
  ts?: string;
  model?: string;
  model_version?: string;
  /** Expected/intended number of steps for this run. */
  intended_steps?: number;
  /** Budget cap in USD for this run (enforced by proxy mode). */
  budget_usd?: number;
}

export type LogRecord =
  | ({ type: "run" } & RunHeader)
  | ({ type: "step" } & StepRecord & { run_id: string });

export interface NormalizedRun {
  run_id: string;
  workflow?: string;
  customer?: string;
  ts?: string;
  model?: string;
  model_version?: string;
  intended_steps?: number;
  budget_usd?: number;
  steps: StepRecord[];
  unversioned: boolean;
}

export interface StepCost {
  step: string;
  model?: string;
  model_version?: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  message_index?: number;
  status?: string;
  upstream?: string;
  intended?: boolean;
}

export interface RunAnalysis {
  run_id: string;
  workflow?: string;
  customer?: string;
  model?: string;
  model_version?: string;
  unversioned: boolean;
  total_cost_usd: number;
  total_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  step_count: number;
  intended_step_count: number;
  steps: StepCost[];
  retry: {
    inflated: boolean;
    intended_calls: number;
    actual_calls: number;
    looping_step?: string;
    amplification: number;
  };
  context_creep: {
    ratio: number;
    first_cost_usd: number;
    last_cost_usd: number;
    flagged: boolean;
  };
  verdict: "keep" | "investigate";
  verdict_reasons: string[];
}

export interface DriftComparison {
  workflow: string;
  baseline_version?: string;
  current_version?: string;
  baseline_score: number;
  current_score: number;
  delta: number;
  compared: boolean;
  unversioned_runs: string[];
  excluded_runs: string[];
  verdict: "keep" | "investigate";
  diff: Array<{
    run_id: string;
    baseline?: number;
    current?: number;
    delta?: number;
  }>;
}

export interface BudgetDecision {
  allowed: boolean;
  spent_usd: number;
  cap_usd: number;
  remaining_usd: number;
  stopped_at_step?: string;
  reason: string;
}

export interface Report {
  generated_at: string;
  source: string;
  runs: RunAnalysis[];
  totals: {
    runs: number;
    cost_usd: number;
    latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    flagged_runs: number;
    unversioned_runs: number;
    attributed_cost_usd: number;
    unattributed_cost_usd: number;
  };
  retry_loops: Array<{ run_id: string; workflow?: string; looping_step?: string; intended: number; actual: number }>;
  context_creep: Array<{ run_id: string; ratio: number; flagged: boolean }>;
  drift: DriftComparison[];
  verdict_counts: { keep: number; investigate: number };
  findings: string[];
}