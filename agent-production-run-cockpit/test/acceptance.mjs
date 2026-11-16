import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "dist", "cli.js");
const out = path.join(root, "report-output");
let pass = 0, fail = 0;
function check(label, ok) {
  if (ok) { pass++; console.log("  PASS:", label); }
  else { fail++; console.log("  FAIL:", label); }
}

// Clean
try { fs.rmSync(out, { recursive: true, force: true }); } catch {}

// 1. Analyze 30-run fixture
console.log("=== Test 1: 30-run fixture ===");
execSync(`node ${cli} analyze --file fixtures/runs-30.jsonl --out-dir ${out}`, { cwd: root, stdio: "inherit" });
const report = JSON.parse(fs.readFileSync(path.join(out, "report.json"), "utf8"));
check("30 runs analyzed", report.totals.runs === 30);
const loopRun = report.runs.find(r => r.run_id === "run-001");
check("retry loop detected in run-001", loopRun.retry.inflated === true);
check("looping step named", loopRun.retry.looping_step === "call-upstream-api");
check("customer present", loopRun.customer === "cust-1");
check("31 actual vs 4 intended", loopRun.retry.actual_calls === 31 && loopRun.retry.intended_calls === 4);
const creepRun = report.runs.find(r => r.run_id === "run-002");
check("context growth ratio ~9x", Math.abs(creepRun.context_creep.ratio - 9) < 0.01);
check("investigate verdict present", report.verdict_counts.investigate > 0);
check("run-001 verdict investigate", loopRun.verdict === "investigate");

// 2. Drift / unversioned
console.log("=== Test 2: unversioned exclusion ===");
const driftOut = path.join(root, "drift-output");
try { fs.rmSync(driftOut, { recursive: true, force: true }); } catch {}
execSync(`node ${cli} drift --baseline fixtures/regression-baseline.json --current fixtures/regression-current.json --runs fixtures/runs-30.jsonl --out-dir ${driftOut}`, { cwd: root, stdio: "inherit" });
const driftReport = JSON.parse(fs.readFileSync(path.join(driftOut, "drift-report.json"), "utf8"));
const d = driftReport.drift[0];
check("unversioned runs reported", d.unversioned_runs.length > 0);
check("excluded runs present", d.excluded_runs.length > 0);
// unversioned excluded from comparison (current_score computed only versioned)
const currentUnversioned = driftReport.drift.flatMap(x => x.unversioned_runs).length;
check("unversioned runs not silently passing", currentUnversioned > 0);

// 3. End-to-end proxy receipt
console.log("=== Test 3: budget proxy receipt ===");
const proxyOut = path.join(root, "proxy-output");
try { fs.rmSync(proxyOut, { recursive: true, force: true }); } catch {}
execSync(`node ${cli} proxy --file fixtures/proxy-run.json --budget 0.02 --out-dir ${proxyOut}`, { cwd: root, stdio: "inherit" });
const receipt = JSON.parse(fs.readFileSync(path.join(proxyOut, "budget-receipt.json"), "utf8"));
check("receipt has receipts", Array.isArray(receipt.receipts) && receipt.receipts.length > 0);
check("per-step cost present", receipt.receipts[0].cost > 0);
check("budget cap enforced", receipt.final_spent <= 0.02 + 1e-9);

// Analyze proxy run for full receipt (per-step cost, retry, context growth, model version, verdict)
const proxyReportOut = path.join(root, "proxy-report");
try { fs.rmSync(proxyReportOut, { recursive: true, force: true }); } catch {}
execSync(`node ${cli} analyze --file fixtures/proxy-run.json --out-dir ${proxyReportOut}`, { cwd: root, stdio: "inherit" });
const proxyReport = JSON.parse(fs.readFileSync(path.join(proxyReportOut, "report.json"), "utf8"));
const pr = proxyReport.runs[0];
check("per-step cost breakdown", pr.steps.length === 4 && pr.steps.every(s => s.cost_usd >= 0));
check("retry count present", typeof pr.retry.actual_calls === "number");
check("context-growth ratio present", typeof pr.context_creep.ratio === "number");
check("model version present", pr.model_version === "gpt-4o-2024-08-06");
check("verdict present", pr.verdict === "keep" || pr.verdict === "investigate");

// Server smoke
console.log("=== Test 4: server ===");
const srv = (await import("node:child_process")).spawn("node", [cli, "serve", "--file", "fixtures/runs-30.jsonl", "--port", "8799"], { cwd: root });
await new Promise(res => setTimeout(res, 1500));
const http = await import("node:http");
await new Promise((resolve, reject) => {
  http.get("http://localhost:8799/health", (resp) => {
    let d = ""; resp.on("data", c => d += c); resp.on("end", () => {
      try { const j = JSON.parse(d); check("health endpoint ok", j.ok === true && j.runs === 30); resolve(); }
      catch (e) { fail++; console.log("  FAIL: health parse", e.message); resolve(); }
    });
  }).on("error", e => { fail++; console.log("  FAIL: server", e.message); resolve(); });
});
srv.kill();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
