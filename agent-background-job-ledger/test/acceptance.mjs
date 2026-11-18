import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LedgerDb } from "../dist/db.js";
import { registerAndRunJob, runCommand } from "../dist/runner.js";
import { NoticeService } from "../dist/notice.js";
import { Reaper } from "../dist/reaper.js";
import { scrubOutput } from "../dist/scrub.js";

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "abjl-test-"));
  return path.join(dir, "ledger.sqlite");
}

// Test 1: Crash recovery — job survives crash, notice delivered at-least-once
await testAsync("crash-recovery: job survives host crash, notice replayed", async () => {
  const ledgerPath = freshLedger();
  const owner = { tenant: "t1", thread: "th1", turn: "tu1" };

  const db = new LedgerDb(ledgerPath);
  const { job } = await registerAndRunJob(
    db,
    owner,
    "echo 'build ok' && echo 'exit 0'",
    [],
    {}
  );
  assert.equal(job.status, "completed");
  assert.equal(job.exitCode, 0);

  // Simulate crash: close db, create new one (simulates restart)
  db.close();

  const db2 = new LedgerDb(ledgerPath);
  const jobsAfterRestart = db2.listJobs();
  assert.equal(jobsAfterRestart.length, 1);
  assert.equal(jobsAfterRestart[0].id, job.id);
  assert.equal(jobsAfterRestart[0].status, "completed");

  // Replay unacked notices
  const service = new NoticeService(db2);
  const replayed = service.replayUnacked();
  assert.equal(replayed.length, 1);
  assert.equal(replayed[0].jobId, job.id);

  // Ack the notice
  const acked = service.ack(replayed[0].id);
  assert.equal(acked.status, "acked");

  // Second replay should find nothing
  const replayedAgain = service.replayUnacked();
  assert.equal(replayedAgain.length, 0);

  db2.close();
  console.log("  crash-recovery passed");
});

// Test 2: Exit-status fidelity — pipeline failure detected with pipefail
await testAsync("exit-status: pipefail detects failing pipeline stage", async () => {
  const ledgerPath = freshLedger();
  const owner = { tenant: "t1", thread: "th1", turn: "tu2" };

  const db = new LedgerDb(ledgerPath);

  // Without pipefail: exit code of last command (0)
  const { job: jobNoPipefail } = await registerAndRunJob(
    db,
    owner,
    "echo 'FAIL: test_broken' && exit 1 | cat",
    [],
    { capturePipefail: false }
  );
  // Without pipefail, exit code is 0 (cat succeeds)
  assert.equal(jobNoPipefail.exitCode, 0);
  assert.equal(jobNoPipefail.status, "completed");

  // With pipefail: exit code of failing stage
  const { job: jobPipefail } = await registerAndRunJob(
    db,
    owner,
    "echo 'FAIL: test_broken' && exit 1 | cat",
    [],
    { capturePipefail: true }
  );
  assert.equal(jobPipefail.exitCode, 1);
  assert.equal(jobPipefail.status, "failed");

  // Output contains the failing stage marker
  assert.ok(jobPipefail.stdout.includes("FAIL: test_broken"));

  db.close();
  console.log("  exit-status passed");
});

// Test 3: Orphan reaping — turn gone, job reaped and surfaced
await testAsync("orphan-reaping: turn gone, job reaped and surfaced", async () => {
  const ledgerPath = freshLedger();
  const owner = { tenant: "t1", thread: "th1", turn: "tu3" };

  const db = new LedgerDb(ledgerPath);
  await registerAndRunJob(db, owner, "echo 'orphan build'", [], {});

  // Turn is active initially
  const turn = db.getTurn(owner.tenant, owner.thread, owner.turn);
  assert.ok(turn);
  assert.ok(turn.isActive);

  // Deactivate turn (simulates turn ending)
  db.registerTurn({ ...turn, isActive: false });

  // Reaper should reap the job
  const reaper = new Reaper(db);
  const result = reaper.reapOrphans();
  assert.equal(result.reaped.length, 1);
  assert.equal(result.kept.length, 0);

  // Job is now reaped
  const job = db.getJob(result.reaped[0].id);
  assert.equal(job.status, "reaped");

  // Reap record surfaced
  const reaps = db.listReaps();
  assert.equal(reaps.length, 1);
  assert.equal(reaps[0].jobId, job.id);
  assert.equal(reaps[0].reason, "turn_gone");

  db.close();
  console.log("  orphan-reaping passed");
});

// Test 4: At-least-once notice delivery
await testAsync("notice-delivery: at-least-once delivery and ack idempotency", async () => {
  const ledgerPath = freshLedger();
  const owner = { tenant: "t1", thread: "th1", turn: "tu4" };

  const db = new LedgerDb(ledgerPath);
  const { job, noticeId } = await registerAndRunJob(db, owner, "echo 'deliver test'", [], {});

  const service = new NoticeService(db);

  // Deliver
  const delivered = service.deliver(noticeId);
  assert.equal(delivered.status, "delivered");
  assert.equal(delivered.attempts, 1);

  // Deliver again (at-least-once)
  const deliveredAgain = service.deliver(noticeId);
  assert.equal(deliveredAgain.attempts, 2);

  // Ack
  const acked = service.ack(noticeId);
  assert.equal(acked.status, "acked");
  assert.ok(acked.ackedAt);

  // Ack again (idempotent)
  const ackedAgain = service.ack(noticeId);
  assert.equal(ackedAgain.status, "acked");
  assert.equal(ackedAgain.ackedAt, acked.ackedAt);

  // Unacked notices for this owner: none
  const unacked = service.unackedByOwner(owner);
  assert.equal(unacked.length, 0);

  db.close();
  console.log("  notice-delivery passed");
});

// Test 5: Secret scrubbing
test("scrubbing: secrets redacted and output bounded", () => {
  const input = "API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890\ntoken=ghp_abcdefghijklmnopqrstuvwxyz0123456789\nnormal output";
  const scrubbed = scrubOutput(input);
  assert.ok(!scrubbed.includes("sk-abcdefghijklmnopqrstuvwxyz1234567890"), "sk- key should be redacted");
  assert.ok(!scrubbed.includes("ghp_abcdefghijklmnopqrstuvwxyz0123456789"), "ghp_ key should be redacted");
  assert.ok(scrubbed.includes("[REDACTED]"), "should contain [REDACTED] marker");
  assert.ok(scrubbed.includes("normal output"), "normal output should be preserved");

  // Bounding
  const largeInput = "x".repeat(50000);
  const bounded = scrubOutput(largeInput, { maxBytes: 1024 });
  assert.ok(bounded.length < 1100, `expected bounded output < ~1.1KB, got ${bounded.length} bytes`);
  assert.ok(bounded.includes("[truncated"), "should include truncation marker");

  console.log("  scrubbing passed");
});

// Test 6: Job lifecycle state machine
await testAsync("job-lifecycle: registered -> running -> completed/failed -> reaped", async () => {
  const ledgerPath = freshLedger();
  const owner = { tenant: "t1", thread: "th1", turn: "tu5" };

  const db = new LedgerDb(ledgerPath);
  const { job } = await registerAndRunJob(db, owner, "echo 'lifecycle'", [], {});
  assert.equal(job.status, "completed");
  assert.equal(job.exitCode, 0);
  assert.ok(job.finishedAt);
  assert.ok(job.stdout.includes("lifecycle"));

  // Job with non-zero exit
  const { job: jobFail } = await registerAndRunJob(db, owner, "echo 'oops' >&2; exit 42", [], {});
  assert.equal(jobFail.status, "failed");
  assert.equal(jobFail.exitCode, 42);
  assert.ok(jobFail.stderr.includes("oops"));

  db.close();
  console.log("  job-lifecycle passed");
});

// Test 7: Multiple jobs, multiple turns
await testAsync("multi-owner: jobs isolated by tenant/thread/turn", async () => {
  const ledgerPath = freshLedger();

  const db = new LedgerDb(ledgerPath);
  await registerAndRunJob(db, { tenant: "t1", thread: "th1", turn: "tu6" }, "echo 'job1'", [], {});
  await registerAndRunJob(db, { tenant: "t1", thread: "th1", turn: "tu7" }, "echo 'job2'", [], {});
  await registerAndRunJob(db, { tenant: "t2", thread: "th2", turn: "tu8" }, "echo 'job3'", [], {});

  const jobs = db.listJobs();
  assert.equal(jobs.length, 3);

  const jobsT1Tu6 = db.listJobsByOwner("t1", "th1", "tu6");
  assert.equal(jobsT1Tu6.length, 1);

  const jobsT1 = db.listJobsByOwner("t1", "th1", "tu6");
  assert.equal(jobsT1.length, 1);

  db.close();
  console.log("  multi-owner passed");
});

// Test 8: Reaper keeps jobs with active owner turns
await testAsync("reaper: keeps jobs whose turn is still active", async () => {
  const ledgerPath = freshLedger();
  const owner = { tenant: "t1", thread: "th1", turn: "tu9" };

  const db = new LedgerDb(ledgerPath);
  await registerAndRunJob(db, owner, "echo 'keep me'", [], {});

  const reaper = new Reaper(db);
  const result = reaper.reapOrphans();
  assert.equal(result.reaped.length, 0);
  assert.equal(result.kept.length, 1);

  db.close();
  console.log("  reaper-keeps-active passed");
});

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
if (failures > 0) {
  process.exit(1);
}