import * as fs from "fs";
import * as path from "path";
import { Server } from "./server.js";
import { readJsonl, normalizeRuns } from "./ingest.js";
import { buildReport, writeReportFiles, renderHtml } from "./report.js";
import { BudgetCap } from "./budget.js";
import { RegressionRecord, compareDrift } from "./drift.js";
import { NormalizedRun, RunAnalysis } from "./types.js";

function loadFixtures(dir: string): { baseline: RegressionRecord[]; current: RegressionRecord[] } {
  const basePath = path.join(dir, "fixtures", "regression-baseline.json");
  const curPath = path.join(dir, "fixtures", "regression-current.json");
  const baseline = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, "utf8")) : [];
  const current = fs.existsSync(curPath) ? JSON.parse(fs.readFileSync(curPath, "utf8")) : [];
  return { baseline, current };
}

function usage(): void {
  console.error(`
Usage: agent-production-run-cockpit <command> [options]

Commands:
  analyze   --file <jsonl> [--out-dir <dir>] [--drift-baseline <file>] [--drift-current <file>]
            Analyze a JSONL run log and emit HTML/JSON reports.
  serve     --file <jsonl> [--port <n>] [--out-dir <dir>]
            Serve a local web view of the report (auto-reload on file change).
  proxy     --file <jsonl> --budget <usd> [--out-dir <dir>]
            Simulate budget-cap enforcement over a run; emit receipt.
  drift     --baseline <file> --current <file> [--runs <jsonl>] [--out-dir <dir>]
            Compare drift between two regression sets; optionally cross-check with runs.
  fixtures  --out-dir <dir>
            Generate acceptance fixture files (runs-30.jsonl, regression sets, proxy-run.json).
`);
  process.exit(1);
}

async function cmdAnalyze(args: string[]): Promise<void> {
  let file = "";
  let outDir = "report-output";
  let driftBase = "";
  let driftCur = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") file = args[++i];
    else if (args[i] === "--out-dir") outDir = args[++i];
    else if (args[i] === "--drift-baseline") driftBase = args[++i];
    else if (args[i] === "--drift-current") driftCur = args[++i];
  }
  if (!file) { console.error("analyze: --file required"); usage(); }
  const recs = readJsonl(file);
  const runs = normalizeRuns(recs);
  let baseline: RegressionRecord[] = [];
  let current: RegressionRecord[] = [];
  if (driftBase && driftCur) {
    baseline = JSON.parse(fs.readFileSync(driftBase, "utf8"));
    current = JSON.parse(fs.readFileSync(driftCur, "utf8"));
  }
  const report = buildReport(runs, file, { baseline, current });
  const { json, html } = writeReportFiles(report, outDir);
  console.log(`Report written: ${json}, ${html}`);
}

async function cmdServe(args: string[]): Promise<void> {
  let file = "";
  let port = 8787;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") file = args[++i];
    else if (args[i] === "--port") port = Number(args[++i]);
  }
  if (!file) { console.error("serve: --file required"); usage(); }
  const server = new Server(port, file);
  server.start();
  console.log(`Serving ${file} on http://localhost:${port}`);
}

async function cmdProxy(args: string[]): Promise<void> {
  let file = "";
  let budget = 0;
  let outDir = "report-output";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file") file = args[++i];
    else if (args[i] === "--budget") budget = Number(args[++i]);
    else if (args[i] === "--out-dir") outDir = args[++i];
  }
  if (!file || budget <= 0) { console.error("proxy: --file and --budget > 0 required"); usage(); }
  const recs = readJsonl(file);
  const runs = normalizeRuns(recs);
  const cap = new BudgetCap(budget);
  const receipts: Array<{ run_id: string; step: string; cost: number; decision: any }> = [];
  for (const run of runs) {
    for (const step of run.steps) {
      const cost = step.cost_usd ?? 0;
      const d = cap.canSpend(step.step, cost);
      receipts.push({ run_id: run.run_id, step: step.step, cost, decision: d });
      if (!d.allowed) break;
    }
  }
  const out = {
    budget_usd: budget,
    final_spent: cap.snapshot().spent_usd,
    stopped: cap.snapshot().stopped_at_step,
    receipts,
  };
  fs.mkdirSync(outDir, { recursive: true });
  const json = path.join(outDir, "budget-receipt.json");
  fs.writeFileSync(json, JSON.stringify(out, null, 2), "utf8");
  console.log(`Budget receipt: ${json}`);
  console.log(`Spent: $${out.final_spent.toFixed(4)} / Cap: $${budget.toFixed(4)}${out.stopped ? ` (STOPPED at ${out.stopped})` : ""}`);
}

async function cmdDrift(args: string[]): Promise<void> {
  let base = "";
  let cur = "";
  let runsFile = "";
  let outDir = "report-output";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--baseline") base = args[++i];
    else if (args[i] === "--current") cur = args[++i];
    else if (args[i] === "--runs") runsFile = args[++i];
    else if (args[i] === "--out-dir") outDir = args[++i];
  }
  if (!base || !cur) { console.error("drift: --baseline and --current required"); usage(); }
  const baseline = JSON.parse(fs.readFileSync(base, "utf8"));
  const current = JSON.parse(fs.readFileSync(cur, "utf8"));
  let runs: NormalizedRun[] = [];
  if (runsFile) runs = normalizeRuns(readJsonl(runsFile));
  const drift = compareDrift(baseline, current, runs);
  fs.mkdirSync(outDir, { recursive: true });
  const json = path.join(outDir, "drift-report.json");
  fs.writeFileSync(json, JSON.stringify({ generated_at: new Date().toISOString(), drift }, null, 2), "utf8");
  console.log(`Drift report: ${json}`);
}

async function cmdFixtures(args: string[]): Promise<void> {
  let outDir = "fixtures";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out-dir") outDir = args[++i];
  }
  fs.mkdirSync(outDir, { recursive: true });
  // Generate runs-30.jsonl
  const lines: string[] = [];
  const runCount = 30;
  for (let ri = 1; ri <= runCount; ri++) {
    const runId = `run-${ri.toString().padStart(3, "0")}`;
    const workflow = ri <= 10 ? "wf-alpha" : ri <= 20 ? "wf-beta" : "wf-gamma";
    const customer = ri <= 10 ? "cust-1" : ri <= 20 ? "cust-2" : "cust-3";
    const model = "gpt-4o";
    const model_version = ri % 3 === 0 ? undefined : "gpt-4o-2024-08-06";
    const intended = ri === 1 ? 4 : ri === 2 ? 4 : 5;
    const budget = 0.05;

    // run header
    lines.push(JSON.stringify({
      type: "run", run_id: runId, workflow, customer, model, model_version, intended_steps: intended, budget_usd: budget,
    }));

    // steps
    let stepCount = intended;
    if (ri === 1) {
      // retry loop: 4 intended -> 31 actual
      stepCount = 31;
    } else if (ri === 2) {
      // context creep: 50 messages (50th message ~9x first-message cost)
      stepCount = 50;
    }
    for (let si = 1; si <= stepCount; si++) {
      const isRetryLoop = ri === 1 && si > 4;
      const stepName = isRetryLoop ? "call-upstream-api" : `step-${si}`;
      const intendedFlag = !isRetryLoop && si <= intended;
      const messageIndex = si;
      // tokens: context creep: 50th message ~9x cost of first (run-2)
      let inputTokens = 1000 + (ri === 2 && messageIndex >= 50 ? 8000 : 0);
      let outputTokens = 500 + (ri === 2 && messageIndex >= 50 ? 4000 : 0);
      if (ri === 1 && si > 4) { inputTokens = 500; outputTokens = 300; }
      const cost = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;
      lines.push(JSON.stringify({
        type: "step", run_id: runId, step: stepName, model, model_version,
        input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: cost,
        latency_ms: 200 + (ri === 1 && isRetryLoop ? 50 : 0),
        message_index: messageIndex,
        status: intendedFlag ? "ok" : "retried",
        upstream: "upstream-api",
        intended: intendedFlag,
        workflow, customer,
      }));
    }
  }
  fs.writeFileSync(path.join(outDir, "runs-30.jsonl"), lines.join("\n") + "\n", "utf8");

  // regression-baseline.json
  const baseline: RegressionRecord[] = [];
  for (const wf of ["wf-alpha", "wf-beta", "wf-gamma"]) {
    for (let i = 0; i < 5; i++) {
      baseline.push({ run_id: `base-${wf}-${i}`, workflow: wf, model_version: "gpt-4o-2024-08-06", score: 0.82 + Math.random() * 0.06 });
    }
  }
  // add some unversioned baseline
  for (let i = 0; i < 2; i++) baseline.push({ run_id: `base-unv-${i}`, workflow: "wf-alpha", score: 0.75 });
  fs.writeFileSync(path.join(outDir, "regression-baseline.json"), JSON.stringify(baseline, null, 2), "utf8");

  // regression-current.json (some drift, some unversioned)
  const current: RegressionRecord[] = [];
  for (const wf of ["wf-alpha", "wf-beta", "wf-gamma"]) {
    for (let i = 0; i < 5; i++) {
      current.push({ run_id: `cur-${wf}-${i}`, workflow: wf, model_version: "gpt-4o-2024-11-20", score: 0.78 + Math.random() * 0.06 });
    }
  }
  // unversioned current runs (should be excluded)
  for (let i = 0; i < 3; i++) current.push({ run_id: `cur-unv-${i}`, workflow: "wf-alpha", score: 0.7 });
  fs.writeFileSync(path.join(outDir, "regression-current.json"), JSON.stringify(current, null, 2), "utf8");

  // proxy-run.json (single run for end-to-end proxy test)
  const proxyRun = {
    type: "run", run_id: "proxy-run-001", workflow: "wf-proxy", customer: "cust-proxy",
    model: "gpt-4o", model_version: "gpt-4o-2024-08-06", intended_steps: 4, budget_usd: 0.02,
  };
  const proxySteps = [
    { step: "step-1", input: 800, output: 400 },
    { step: "step-2", input: 900, output: 450 },
    { step: "step-3", input: 1000, output: 500 },
    { step: "step-4", input: 1100, output: 550 },
  ];
  const proxyLines = [JSON.stringify(proxyRun)];
  for (let i = 0; i < proxySteps.length; i++) {
    const s = proxySteps[i];
    const cost = (s.input * 2.5 + s.output * 10) / 1_000_000;
    proxyLines.push(JSON.stringify({
      type: "step", run_id: "proxy-run-001", step: s.step, model: "gpt-4o", model_version: "gpt-4o-2024-08-06",
      input_tokens: s.input, output_tokens: s.output, cost_usd: cost, latency_ms: 300, message_index: i + 1,
      status: "ok", upstream: "upstream-api", intended: true, workflow: "wf-proxy", customer: "cust-proxy",
    }));
  }
  fs.writeFileSync(path.join(outDir, "proxy-run.json"), proxyLines.join("\n") + "\n", "utf8");

  console.log(`Fixtures generated in ${outDir}:`);
  console.log("  runs-30.jsonl");
  console.log("  regression-baseline.json");
  console.log("  regression-current.json");
  console.log("  proxy-run.json");
}

// Main
const [,, cmd, ...args] = process.argv;
switch (cmd) {
  case "analyze": cmdAnalyze(args); break;
  case "serve": cmdServe(args); break;
  case "proxy": cmdProxy(args); break;
  case "drift": cmdDrift(args); break;
  case "fixtures": cmdFixtures(args); break;
  default: usage();
}