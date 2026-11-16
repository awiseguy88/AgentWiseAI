#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { runWithRelay, getCachedResult } from "./relay.js";
import { idempotencyKey, loadLedger } from "./ledger.js";
import { StepDefinition } from "./types.js";
import { MockExternalApi, TimeoutError } from "./mockApi.js";

function usage(): void {
  console.log(`agent-compensation-relay

Usage:
  agent-compensation-relay demo [--ledger <path>]
  agent-compensation-relay replay-demo [--ledger <path>]
  agent-compensation-relay report --ledger <path> --run <runId>
  agent-compensation-relay --help

Commands:
  demo         Run the 3-step mock scenario: step 2 times out after commit.
               Compensates step 1 in reverse order, never runs step 3, prints residue JSON.
  replay-demo  Replays step 1 of the demo run with same idempotency key and shows cache hit.
  report       Print stored residue-like view from ledger for a run.

Options:
  --ledger <path>  Ledger JSON path (default: .local/agent-compensation-relay-ledger.json)
  --run <runId>    Run id (for report)
`);
}

function parseArgs(argv: string[]): { cmd: string; flags: Record<string, string> } {
  const cmd = argv[0] && !argv[0].startsWith("-") ? argv[0] : "help";
  const flags: Record<string, string> = {};
  for (let i = cmd === "help" ? 0 : 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") flags.help = "1";
    else if (a === "--ledger") flags.ledger = argv[++i];
    else if (a === "--run") flags.run = argv[++i];
  }
  return { cmd, flags };
}

export function buildThreeStepScenario(api: MockExternalApi, ledgerPath: string, runId: string) {
  const steps: StepDefinition[] = [
    {
      toolCallId: "step-1-reserve-stock",
      execute: async () => {
        const result = await api.reserveStock({ item: "widget", qty: 1 });
        return { outcome: "success", result };
      },
      compensate: async (_ctx, result: any) => {
        await api.releaseReservation({ reservationId: result?.reservationId ?? "res-1" });
      },
    },
    {
      toolCallId: "step-2-charge-card",
      execute: async () => {
        try {
          const result = await api.chargeCard({ amount: 4999, reservationId: "res-1" });
          return { outcome: "success", result };
        } catch (err: any) {
          if (err instanceof TimeoutError && err.unknownOutcome) {
            return { outcome: "unknown", error: err.message, committed: true };
          }
          return { outcome: "failure", error: err?.message || String(err) };
        }
      },
      compensate: async () => {
        await api.reverseCharge({ reservationId: "res-1" });
      },
    },
    {
      toolCallId: "step-3-send-email",
      execute: async () => {
        const result = await api.sendEmail({ to: "customer@example.com", subject: "Order confirmed" });
        return { outcome: "success", result };
      },
    },
  ];
  return { runId, ledgerPath, steps };
}

export async function runDemo(ledgerPath: string): Promise<{ report: any; api: MockExternalApi }> {
  const runId = "demo-run-3step";
  const api = new MockExternalApi({ chargeOutcome: "unknown-timeout" });
  const scenario = buildThreeStepScenario(api, ledgerPath, runId);
  const report = await runWithRelay(scenario);
  return { report, api };
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  if (flags.help || cmd === "help" || cmd === "--help") {
    usage();
    return;
  }

  const ledgerPath = path.resolve(flags.ledger || ".local/agent-compensation-relay-ledger.json");

  if (cmd === "demo") {
    if (fs.existsSync(ledgerPath)) fs.unlinkSync(ledgerPath);
    const { report, api } = await runDemo(ledgerPath);
    console.log(JSON.stringify({
      report,
      mockExternalApiCalls: api.calls.map((c) => c.tool),
      committedServerSide: api.committed,
    }, null, 2));
    return;
  }

  if (cmd === "replay-demo") {
    // After demo: retry step 1 with same idempotency key - must return cached result without invoking API.
    const runId = "demo-run-3step";
    const toolCallId = "step-1-reserve-stock";
    const cache = getCachedResult(ledgerPath, runId, toolCallId);
    const key = idempotencyKey(runId, toolCallId);
    const api = new MockExternalApi({ chargeOutcome: "unknown-timeout" });
    const scenario = buildThreeStepScenario(api, ledgerPath, runId);
    // Re-running the same scenario should replay completed steps without external calls.
    const report = await runWithRelay(scenario);
    console.log(JSON.stringify({
      idempotencyKey: key,
      cacheHit: cache.hit,
      cachedResult: cache.result,
      replayExternalCalls: api.calls.map((c) => c.tool),
      report,
    }, null, 2));
    return;
  }

  if (cmd === "report") {
    if (!flags.run) throw new Error("--run is required");
    const ledger = loadLedger(ledgerPath);
    const run = ledger.runs[flags.run];
    if (!run) {
      console.error(`Run not found: ${flags.run}`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(run, null, 2));
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  usage();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
