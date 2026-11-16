import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runWithRelay } from "../dist/relay.js";
import { MockExternalApi, TimeoutError } from "../dist/mockApi.js";

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}

function freshLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "acr-test-"));
  return path.join(dir, "ledger.json");
}

function threeStepScenario(api, ledgerPath, runId, opts = {}) {
  return {
    runId,
    ledgerPath,
    steps: [
      {
        toolCallId: "step-1-reserve-stock",
        execute: async () => ({ outcome: "success", result: await api.reserveStock({ item: "widget", qty: 1 }) }),
        compensate: async (_ctx, result) => {
          api.compensationOrder.push("step-1-reserve-stock");
          await api.releaseReservation({ reservationId: result?.reservationId ?? "res-1" });
        },
      },
      {
        toolCallId: "step-2-charge-card",
        execute: async () => {
          try {
            return { outcome: "success", result: await api.chargeCard({ amount: 4999 }) };
          } catch (err) {
            if (err instanceof TimeoutError && err.unknownOutcome) {
              return { outcome: "unknown", error: err.message, committed: true };
            }
            return { outcome: "failure", error: err?.message || String(err) };
          }
        },
        compensate: async () => {
          api.compensationOrder.push("step-2-charge-card");
          await api.reverseCharge({ reservationId: "res-1" });
        },
      },
      {
        toolCallId: "step-3-send-email",
        execute: async () => {
          if (opts.sendEmailError) {
            return { outcome: "failure", error: opts.sendEmailError };
          }
          return { outcome: "success", result: await api.sendEmail({ to: "c@example.com" }) };
        },
        compensate: async () => {
          api.compensationOrder.push("step-3-send-email");
        },
      },
    ],
  };
}

// --- Acceptance (1): step 2 times out after committing; step 1 compensated exactly once; step 3 never runs ---
await testAsync("acceptance-1: unknown outcome at step 2 compensates step 1 once, skips step 3", async () => {
  const ledgerPath = freshLedger();
  const api = new MockExternalApi({ chargeOutcome: "unknown-timeout" });
  api.compensationOrder = [];
  const report = await runWithRelay(threeStepScenario(api, ledgerPath, "run-a1"));

  assert.equal(report.aborted, true, "report should be aborted");
  assert.match(report.abortReason || "", /unknown outcome/i);

  const byId = Object.fromEntries(report.steps.map((s) => [s.toolCallId, s]));
  assert.equal(byId["step-1-reserve-stock"].status, "compensated");
  assert.equal(byId["step-1-reserve-stock"].compensated, true);
  assert.equal(byId["step-2-charge-card"].status, "unknown");
  assert.equal(byId["step-2-charge-card"].compensated, false);
  assert.equal(byId["step-3-send-email"].status, "skipped");
  assert.equal(byId["step-3-send-email"].invokedExternal, false);

  // step 1 compensation ran exactly once
  assert.equal(api.count("releaseReservation"), 1);
  assert.deepEqual(api.compensationOrder, ["step-1-reserve-stock"]);
  // step 3 never invoked
  assert.equal(api.count("sendEmail"), 0);
  // step 2 was attempted exactly once (no retry storm)
  assert.equal(api.count("chargeCard"), 1);
});

// --- Acceptance (2): retry same idempotency key after completion returns cached result, no external call ---
await testAsync("acceptance-2: replay returns cached result without invoking external API", async () => {
  const ledgerPath = freshLedger();
  const api1 = new MockExternalApi({ chargeOutcome: "ok" });
  const report1 = await runWithRelay(threeStepScenario(api1, ledgerPath, "run-a2"));
  const step1 = report1.steps.find((s) => s.toolCallId === "step-1-reserve-stock");
  assert.equal(step1.status, "executed");
  assert.equal(api1.count("reserveStock"), 1);

  // Retry the whole scenario with a fresh API handle sharing the same ledger.
  const api2 = new MockExternalApi({ chargeOutcome: "ok" });
  api2.compensationOrder = [];
  const report2 = await runWithRelay(threeStepScenario(api2, ledgerPath, "run-a2"));

  // No external calls at all on replay of completed steps.
  assert.equal(api2.count("reserveStock"), 0, "reserveStock must not be re-invoked on replay");
  assert.equal(api2.count("chargeCard"), 0, "chargeCard must not be re-invoked on replay");
  assert.equal(api2.count("sendEmail"), 0, "sendEmail must not be re-invoked on replay");

  const step1b = report2.steps.find((s) => s.toolCallId === "step-1-reserve-stock");
  assert.equal(step1b.status, "executed");
  assert.deepEqual(step1b.result, step1.result, "cached result must equal original result");
});

// --- Unknown outcome stays paused: replay does not re-attempt the unsafe write ---
await testAsync("unknown-outcome pause: replay does not re-attempt step 2", async () => {
  const ledgerPath = freshLedger();
  const api1 = new MockExternalApi({ chargeOutcome: "unknown-timeout" });
  api1.compensationOrder = [];
  await runWithRelay(threeStepScenario(api1, ledgerPath, "run-pause"));

  const api2 = new MockExternalApi({ chargeOutcome: "unknown-timeout" });
  api2.compensationOrder = [];
  const report2 = await runWithRelay(threeStepScenario(api2, ledgerPath, "run-pause"));
  assert.equal(api2.count("chargeCard"), 0, "unknown write must not be re-attempted automatically");
  assert.match(report2.abortReason || "", /reconciliation/i);
});

// --- Reverse-order compensation on plain failure at a later step ---
await testAsync("reverse-order compensation: failure at step 3 compensates step 2 then step 1", async () => {
  const ledgerPath = freshLedger();
  const api = new MockExternalApi({ chargeOutcome: "ok", sendOutcome: "known-error" });
  api.compensationOrder = [];
  const report = await runWithRelay(threeStepScenario(api, ledgerPath, "run-reverse"));

  assert.equal(report.aborted, true);
  const byId = Object.fromEntries(report.steps.map((s) => [s.toolCallId, s]));
  assert.equal(byId["step-3-send-email"].status, "failed");
  assert.equal(byId["step-2-charge-card"].status, "compensated");
  assert.equal(byId["step-1-reserve-stock"].status, "compensated");
  assert.deepEqual(api.compensationOrder, ["step-2-charge-card", "step-1-reserve-stock"]);
});

// --- Idempotency key format ---
await testAsync("idempotency keys use <run_id>:<tool_call_id> and are recorded before execution", async () => {
  const ledgerPath = freshLedger();
  const seenKeys = [];
  const api = new MockExternalApi({ chargeOutcome: "ok" });
  const runId = "run-format";
  const scenario = threeStepScenario(api, ledgerPath, runId);
  // Wrap execute to observe the ledger while executing.
  const origSteps = scenario.steps;
  scenario.steps = origSteps.map((s) => ({
    ...s,
    execute: async (ctx) => {
      seenKeys.push(ctx.idempotencyKey);
      assert.equal(ctx.idempotencyKey, `${runId}:${s.toolCallId}`);
      return s.execute(ctx);
    },
  }));
  await runWithRelay(scenario);
  assert.equal(seenKeys.length, 3);
  assert.equal(seenKeys[0], `${runId}:step-1-reserve-stock`);
});

console.log(failures === 0 ? "\nAll acceptance tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
