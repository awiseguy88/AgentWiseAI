// Offline smoke check for mcp-fault-injector.
//
// Runs the compiled CLI against examples/sample-scenario.json (simulated
// faults) and asserts the produced report contains all five fault types plus
// a baseline, each with per-step classifications.
// No network, no paid APIs, no npm install required beyond TypeScript already
// installed. Run with:  node test/smoke.mjs   (after `npm run build`).

import { spawnSync } from "node:child_process";
import * as path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname);
const CLI = path.join(ROOT, "..", "dist", "cli.js");
const SCENARIO = path.join(ROOT, "..", "examples", "sample-scenario.json");

function runCli(args) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf-8",
    cwd: path.join(ROOT, ".."),
  });
  return res;
}

let failures = 0;
function check(name, cond, detail) {
  const okStr = cond ? "ok" : "FAIL";
  console.log(`  [${okStr}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function main() {
  console.log("mcp-fault-injector smoke check\n");

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  check("Node >= 18", nodeMajor >= 18, `v${process.versions.node}`);

  const res = runCli(["--run", "--scenario", SCENARIO]);
  check("CLI exits 0", res.status === 0, `status=${res.status} stderr=${res.stderr}`);
  if (res.status !== 0) {
    console.error(res.stderr);
    process.exitCode = 1;
    return;
  }

  const out = res.stdout;

  check("Report header present", out.includes("MCP Fault Injector — Report"));
  check("Scenario line present", out.includes("Scenario: sample-mcp-scenario"));
  for (const fault of ["none", "latency", "timeout", "invalidJson", "missingFields", "truncated"]) {
    check(`Fault reported: ${fault}`, out.includes(`Fault: ${fault}`));
  }
  for (const cls of ["clean_failure", "silent_wrong_answer", "ok", "inconclusive"]) {
    check(`Classification seen: ${cls}`, out.includes(cls));
  }

  const noneIdx = out.indexOf("Fault: none");
  check("Baseline has steps", noneIdx !== -1 && out.slice(noneIdx, noneIdx + 400).includes("[ok]"));

  check("timeout clean_failure", out.includes("Fault: timeout") && out.includes("clean_failure"));
  check("invalidJson clean_failure", out.includes("Fault: invalidJson") && out.includes("clean_failure"));
  check("missingFields silent_wrong", out.includes("Fault: missingFields") && out.includes("silent_wrong_answer"));

  console.log("");
  if (failures === 0) {
    console.log("Smoke check passed.");
    process.exitCode = 0;
  } else {
    console.log(`${failures} check(s) failed.`);
    process.exitCode = 1;
  }
}

main();