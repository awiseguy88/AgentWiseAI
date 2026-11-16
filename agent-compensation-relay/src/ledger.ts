import fs from "node:fs";
import path from "node:path";
import { Ledger, RunRecord, StepRecord } from "./types.js";

const emptyLedger = (): Ledger => ({ version: 1, runs: {} });

export function loadLedger(ledgerPath: string): Ledger {
  try {
    const raw = fs.readFileSync(ledgerPath, "utf8");
    const data = JSON.parse(raw) as Ledger;
    if (!data || data.version !== 1 || typeof data.runs !== "object") {
      return emptyLedger();
    }
    return data;
  } catch (err: any) {
    if (err && err.code === "ENOENT") return emptyLedger();
    throw err;
  }
}

export function saveLedger(ledgerPath: string, ledger: Ledger): void {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const tmp = `${ledgerPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, ledgerPath);
}

export function ensureRun(ledger: Ledger, runId: string): RunRecord {
  if (!ledger.runs[runId]) {
    ledger.runs[runId] = {
      runId,
      steps: [],
      updatedAt: new Date().toISOString(),
    };
  }
  return ledger.runs[runId];
}

export function findStep(run: RunRecord, toolCallId: string): StepRecord | undefined {
  return run.steps.find((s) => s.toolCallId === toolCallId);
}

export function upsertStep(run: RunRecord, step: StepRecord): void {
  const idx = run.steps.findIndex((s) => s.toolCallId === step.toolCallId);
  if (idx >= 0) run.steps[idx] = step;
  else run.steps.push(step);
  run.updatedAt = new Date().toISOString();
}

export function idempotencyKey(runId: string, toolCallId: string): string {
  return `${runId}:${toolCallId}`;
}
