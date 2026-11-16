#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyResponse, ScenarioStep, FaultRunResult, FullReport } from "./runner.js";

function printHelp() {
  console.log(`mcp-fault-injector — inject MCP faults and report silent-wrong vs clean failures (offline)

Usage:
  mcp-fault-injector run --scenario <file.json> [--target <stdio-cmd...>]

Examples:
  mcp-fault-injector run --scenario examples/sample-scenario.json

Options:
  --help        Show this help
  --scenario    Path to scenario JSON file
  --target      (optional) reserved for future stdio/http target wiring
  --json-out    (optional) write JSON report to file
`);
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a === "--run") { out.run = true; continue; }
    if (a === "--scenario") { out.scenario = argv[++i] ?? ""; continue; }
    if (a === "--target") { out.target = argv[++i] ?? ""; continue; }
    if (a === "--json-out") { out.jsonOut = argv[++i] ?? ""; continue; }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.scenario) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const scenarioPath = resolve(String(args.scenario));
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf-8")) as { name?: string; steps: ScenarioStep[] };
  const steps = scenario.steps;

  // For MVP/demo: simulate running the five fault types against a known-good baseline
  // by exercising classifyResponse logic in a deterministic way (smoke/integration
  // will run the real proxy paths). This keeps the CLI usable offline without
  // requiring a full MCP client harness in-tree.
  const faultNames = ["none", "latency", "timeout", "invalidJson", "missingFields", "truncated"] as const;
  const results: FaultRunResult[] = [];

  for (const fault of faultNames) {
    const stepResults = steps.map((step) => {
      // Simulate responses per fault for the sample scenario expectations.
      let err: Error | null = null;
      let resp: unknown = {
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ type: "text", text: "OK: sample result" }] },
      };

      if (fault === "timeout") {
        err = new Error("MCP fault: timeout (response dropped for id 1)");
      } else if (fault === "invalidJson") {
        err = new Error("MCP fault: invalid JSON response");
      } else if (fault === "missingFields") {
        resp = { jsonrpc: "2.0", id: 1, result: { } }; // removed content
      } else if (fault === "truncated") {
        resp = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "OK: sample res" }] } }; // truncated mid-word, no closing marker
      } else if (fault === "latency") {
        // latency alone doesn't change payload; classify will be inconclusive/ok depending on checks
        resp = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "OK: sample result" }] } };
      }

      return classifyResponse(fault, err, resp, step);
    });

    const clean = stepResults.filter((r) => r.classification === "clean_failure").length;
    const silent = stepResults.filter((r) => r.classification === "silent_wrong_answer").length;
    const ok = stepResults.filter((r) => r.classification === "ok").length;
    results.push({
      fault,
      steps: stepResults,
      summary: `clean_failures=${clean} silent_wrong=${silent} ok=${ok}`,
    });
  }

  const report: FullReport = {
    timestamp: new Date().toISOString(),
    target: String(args.target ?? "(demo/simulated)"),
    scenario: scenario.name ?? scenarioPath,
    results,
  };

  console.log("MCP Fault Injector — Report");
  console.log("===========================");
  console.log(`Scenario: ${report.scenario}`);
  console.log(`Target:   ${report.target}`);
  console.log(`Time:     ${report.timestamp}`);
  console.log("");
  for (const r of report.results) {
    console.log(`Fault: ${r.fault}  (${r.summary})`);
    for (const s of r.steps) {
      console.log(`  - ${s.step} [${s.classification}]: ${s.notes}`);
    }
    console.log("");
  }

  if (args.jsonOut) {
    const outPath = resolve(String(args.jsonOut));
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
    console.log(`Wrote JSON report to: ${outPath}`);
  }
}

main().catch((err) => {
  console.error("mcp-fault-injector failed:", err);
  process.exit(1);
});
