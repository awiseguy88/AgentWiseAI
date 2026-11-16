export type StepStatus =
  | "pending"
  | "executed"
  | "failed"
  | "compensated"
  | "compensation_failed"
  | "unknown"
  | "skipped";

export interface StepRecord {
  toolCallId: string;
  idempotencyKey: string;
  status: StepStatus;
  attempt: number;
  result?: unknown;
  error?: string;
  compensated?: boolean;
  compensationError?: string;
  invokedExternal?: boolean;
  startedAt?: string;
  finishedAt?: string;
}

export interface RunRecord {
  runId: string;
  steps: StepRecord[];
  aborted?: boolean;
  abortReason?: string;
  updatedAt: string;
}

export interface Ledger {
  version: 1;
  runs: Record<string, RunRecord>;
}

export interface StepDefinition<TResult = unknown> {
  toolCallId: string;
  /** Execute the external side effect; must be idempotent only via relay semantics. */
  execute: (ctx: ExecutionContext) => Promise<StepExecution<TResult>>;
  /** Compensation for committed effects of this step. */
  compensate?: (ctx: ExecutionContext, result: TResult) => Promise<void>;
}

export type StepExecution<TResult = unknown> =
  | { outcome: "success"; result: TResult }
  | { outcome: "failure"; error: string }
  | { outcome: "unknown"; error: string; committed?: boolean };

export interface ExecutionContext {
  runId: string;
  toolCallId: string;
  idempotencyKey: string;
  replayed: boolean;
}

export interface ResidueStep {
  toolCallId: string;
  idempotencyKey: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
  invokedExternal: boolean;
  compensated: boolean;
  compensationError?: string;
}

export interface ResidueReport {
  runId: string;
  aborted: boolean;
  abortReason?: string;
  steps: ResidueStep[];
}
