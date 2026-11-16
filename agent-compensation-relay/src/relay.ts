import { ensureRun, findStep, idempotencyKey, loadLedger, saveLedger, upsertStep } from "./ledger.js";
import {
  ExecutionContext,
  ResidueReport,
  ResidueStep,
  StepDefinition,
  StepRecord,
  StepStatus,
} from "./types.js";

export interface RunOptions {
  runId: string;
  ledgerPath: string;
  steps: StepDefinition[];
}

function now() {
  return new Date().toISOString();
}

function toResidueStep(step: StepRecord): ResidueStep {
  return {
    toolCallId: step.toolCallId,
    idempotencyKey: step.idempotencyKey,
    status: step.status,
    result: step.result,
    error: step.error,
    invokedExternal: !!step.invokedExternal,
    compensated: !!step.compensated,
    compensationError: step.compensationError,
  };
}

export async function runWithRelay(options: RunOptions): Promise<ResidueReport> {
  const { runId, ledgerPath, steps } = options;
  const ledger = loadLedger(ledgerPath);
  const run = ensureRun(ledger, runId);

  const committed: Array<{ def: StepDefinition }> = [];
  let aborted = !!run.aborted;
  let abortReason = run.abortReason;

  for (const def of steps) {
    const key = idempotencyKey(runId, def.toolCallId);
    const existing = findStep(run, def.toolCallId);

    // Replay of a completed/terminal step: never invoke external API again.
    if (existing && (existing.status === "executed" || existing.status === "compensated" || existing.status === "compensation_failed")) {
      if (existing.status === "executed") {
        committed.push({ def });
      }
      continue;
    }

    // If previously unknown/reconciliation-pending, do not re-run unsafe write.
    if (existing && existing.status === "unknown") {
      aborted = true;
      abortReason = abortReason || `Step ${def.toolCallId} requires reconciliation; execution paused`;
      run.aborted = true;
      run.abortReason = abortReason;
      saveLedger(ledgerPath, ledger);
      break;
    }

    // If run already aborted earlier and this step not executed, mark skipped.
    if (aborted) {
      if (!existing || existing.status === "pending") {
        const skipped: StepRecord = {
          toolCallId: def.toolCallId,
          idempotencyKey: key,
          status: "skipped",
          attempt: existing?.attempt ?? 0,
          invokedExternal: false,
        };
        upsertStep(run, skipped);
        saveLedger(ledgerPath, ledger);
      }
      continue;
    }

    // Record before execution.
    const record: StepRecord = existing ?? {
      toolCallId: def.toolCallId,
      idempotencyKey: key,
      status: "pending",
      attempt: 0,
      invokedExternal: false,
    };
    record.attempt = (record.attempt || 0) + 1;
    record.status = "pending";
    record.error = undefined;
    record.startedAt = now();
    record.finishedAt = undefined;
    upsertStep(run, record);
    saveLedger(ledgerPath, ledger);

    const ctx: ExecutionContext = { runId, toolCallId: def.toolCallId, idempotencyKey: key, replayed: false };
    record.invokedExternal = true;
    upsertStep(run, record);
    saveLedger(ledgerPath, ledger);

    let exec;
    try {
      exec = await def.execute(ctx);
    } catch (err: any) {
      exec = { outcome: "failure" as const, error: err?.message || String(err) };
    }

    if (exec.outcome === "success") {
      record.status = "executed";
      record.result = exec.result;
      record.error = undefined;
      record.finishedAt = now();
      upsertStep(run, record);
      saveLedger(ledgerPath, ledger);
      committed.push({ def });
      continue;
    }

    if (exec.outcome === "unknown") {
      record.status = "unknown";
      record.error = exec.error;
      record.finishedAt = now();
      upsertStep(run, record);
      aborted = true;
      abortReason = `Unknown outcome at ${def.toolCallId}: ${exec.error} — execution paused for reconciliation`;
      run.aborted = true;
      run.abortReason = abortReason;
      saveLedger(ledgerPath, ledger);
      // Pause for reconciliation: compensate prior committed steps in reverse order.
      await compensateCommittedReverse(committed, runId, ledgerPath);
      break;
    }

    // failure
    record.status = "failed";
    record.error = exec.error;
    record.finishedAt = now();
    upsertStep(run, record);
    aborted = true;
    abortReason = `Failed at ${def.toolCallId}: ${exec.error}`;
    run.aborted = true;
    run.abortReason = abortReason;
    saveLedger(ledgerPath, ledger);
    await compensateCommittedReverse(committed, runId, ledgerPath);
    break;
  }

  // Ensure steps after abort point are marked skipped in report context.
  if (aborted) {
    const l2 = loadLedger(ledgerPath);
    const r2 = ensureRun(l2, runId);
    for (const def of steps) {
      const rec = findStep(r2, def.toolCallId);
      if (!rec) {
        upsertStep(r2, {
          toolCallId: def.toolCallId,
          idempotencyKey: idempotencyKey(runId, def.toolCallId),
          status: "skipped",
          attempt: 0,
          invokedExternal: false,
        });
      }
    }
    saveLedger(ledgerPath, l2);
  }

  const finalLedger = loadLedger(ledgerPath);
  const finalRun = ensureRun(finalLedger, runId);
  const report: ResidueReport = {
    runId,
    aborted: !!finalRun.aborted || aborted,
    abortReason: finalRun.abortReason || abortReason,
    steps: steps.map((def) => {
      const rec = findStep(finalRun, def.toolCallId);
      if (!rec) {
        return {
          toolCallId: def.toolCallId,
          idempotencyKey: idempotencyKey(runId, def.toolCallId),
          status: "skipped",
          invokedExternal: false,
          compensated: false,
        };
      }
      return toResidueStep(rec);
    }),
  };
  return report;
}

async function compensateCommittedReverse(
  committed: Array<{ def: StepDefinition }>,
  runId: string,
  ledgerPath: string
): Promise<void> {
  for (let i = committed.length - 1; i >= 0; i--) {
    const { def } = committed[i];
    if (!def.compensate) continue;
    const ledger = loadLedger(ledgerPath);
    const run = ensureRun(ledger, runId);
    const latest = findStep(run, def.toolCallId);
    if (!latest) continue;
    if (latest.compensated) continue; // exactly once
    try {
      const ctx: ExecutionContext = {
        runId,
        toolCallId: def.toolCallId,
        idempotencyKey: latest.idempotencyKey,
        replayed: false,
      };
      await def.compensate(ctx, latest.result);
      latest.compensated = true;
      latest.status = "compensated";
      latest.compensationError = undefined;
    } catch (err: any) {
      latest.compensated = false;
      latest.compensationError = err?.message || String(err);
      latest.status = "compensation_failed";
    }
    upsertStep(run, latest);
    saveLedger(ledgerPath, ledger);
  }
}

export function getCachedResult(
  ledgerPath: string,
  runId: string,
  toolCallId: string
): { hit: boolean; result?: unknown; status?: StepStatus } {
  const ledger = loadLedger(ledgerPath);
  const run = ledger.runs[runId];
  if (!run) return { hit: false };
  const step = findStep(run, toolCallId);
  const terminal = step && (step.status === "executed" || step.status === "compensated");
  if (terminal) return { hit: true, result: step.result, status: step.status };
  return { hit: false };
}
