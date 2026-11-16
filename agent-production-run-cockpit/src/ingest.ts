import * as fs from "fs";
import { LogRecord, NormalizedRun, StepRecord } from "./types.js";

export function readJsonl(filePath: string): any[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const out: any[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      // ignore bad line
    }
  }
  return out;
}

export function normalizeRuns(records: any[]): NormalizedRun[] {
  const map = new Map<string, NormalizedRun>();

  function ensureRun(id: string): NormalizedRun {
    let r = map.get(id);
    if (!r) {
      r = { run_id: id, steps: [], unversioned: true };
      map.set(id, r);
    }
    return r;
  }

  for (const rec of records) {
    if (!rec || typeof rec !== "object") continue;
    const type = rec.type ?? (rec.step ? "step" : "run");

    if (type === "run") {
      const run = ensureRun(String(rec.run_id));
      if (rec.workflow) run.workflow = rec.workflow;
      if (rec.customer) run.customer = rec.customer;
      if (rec.ts) run.ts = rec.ts;
      if (rec.model) run.model = rec.model;
      if (rec.model_version) run.model_version = rec.model_version;
      if (rec.intended_steps != null) run.intended_steps = Number(rec.intended_steps);
      if (rec.budget_usd != null) run.budget_usd = Number(rec.budget_usd);
      if (run.model_version) run.unversioned = false;
      continue;
    }

    // step
    const runId = String(rec.run_id ?? "unknown");
    const run = ensureRun(runId);
    const step: StepRecord = {
      step: String(rec.step ?? `step-${run.steps.length + 1}`),
      model: rec.model ?? run.model,
      model_version: rec.model_version ?? run.model_version,
      input_tokens: Number(rec.input_tokens ?? 0),
      output_tokens: Number(rec.output_tokens ?? 0),
      cost_usd: rec.cost_usd != null ? Number(rec.cost_usd) : undefined,
      latency_ms: Number(rec.latency_ms ?? 0),
      ts: rec.ts,
      message_index: rec.message_index != null ? Number(rec.message_index) : undefined,
      status: rec.status,
      upstream: rec.upstream,
      intended: rec.intended === true,
      workflow: rec.workflow ?? run.workflow,
      customer: rec.customer ?? run.customer,
    };
    if (step.workflow) run.workflow = step.workflow;
    if (step.customer) run.customer = step.customer;
    if (step.model && !run.model) run.model = step.model;
    if (step.model_version) {
      run.model_version = step.model_version;
      run.unversioned = false;
    }
    run.steps.push(step);
  }

  return Array.from(map.values());
}