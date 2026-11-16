#!/usr/bin/env node
import { LedgerDb } from "./db.js";
import { registerAndRunJob, runCommand } from "./runner.js";
import { NoticeService } from "./notice.js";
import { Reaper } from "./reaper.js";
import { JobOwner, JobStatus } from "./types.js";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_LEDGER = ".local/agent-background-job-ledger.sqlite";

function parseArgs(argv: string[]): Record<string, string | string[]> {
  const args: Record<string, string | string[]> = {};
  let i = 0;
  while (i < argv.length) {
    const key = argv[i];
    if (key.startsWith("--")) {
      const eq = key.indexOf("=");
      if (eq > -1) {
        args[key.slice(2, eq)] = key.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          args[key.slice(2)] = next;
          i++;
        } else {
          args[key.slice(2)] = "";
        }
      }
    }
    i++;
  }
  return args;
}

function getOwner(args: Record<string, string | string[]>): JobOwner {
  const tenant = String(args.tenant ?? "default-tenant");
  const thread = String(args.thread ?? "default-thread");
  const turn = String(args.turn ?? "default-turn");
  const sandboxGeneration = args["sandbox-generation"]
    ? String(args["sandbox-generation"])
    : undefined;
  return { tenant, thread, turn, sandboxGeneration };
}

function getLedgerPath(args: Record<string, string | string[]>): string {
  return String(args.ledger ?? DEFAULT_LEDGER);
}

async function cmdRegisterAndRun(args: Record<string, string | string[]>) {
  const command = String(args.command ?? "");
  if (!command) {
    console.error("Error: --command is required");
    process.exit(1);
  }
  const argsArray: string[] = [];
  if (Array.isArray(args.args)) {
    argsArray.push(...args.args.map(String));
  }
  const owner = getOwner(args);
  const ledgerPath = getLedgerPath(args);
  const capturePipefail = args.pipefail !== undefined;

  const db = new LedgerDb(ledgerPath);
  try {
    const { job, noticeId } = await registerAndRunJob(
      db,
      owner,
      command,
      argsArray,
      { capturePipefail }
    );
    console.log(`Job ${job.id} registered for ${owner.tenant}/${owner.thread}/${owner.turn}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Exit code: ${job.exitCode ?? "N/A"}`);
    if (job.stdout) console.log(`  Stdout (scrubbed, ${job.stdout.length} bytes):`);
    console.log(`  ${job.stdout.slice(0, 200).replace(/\n/g, "\n  ")}`);
    if (job.stderr) console.log(`  Stderr: ${job.stderr.slice(0, 200).replace(/\n/g, "\n  ")}`);
    console.log(`  Notice: ${noticeId} (status: pending)`);
  } finally {
    db.close();
  }
}

async function cmdList(args: Record<string, string | string[]>) {
  const ledgerPath = getLedgerPath(args);
  const status = args.status ? String(args.status) as JobStatus : undefined;
  const owner = args.tenant || args.thread || args.turn ? getOwner(args) : undefined;

  const db = new LedgerDb(ledgerPath);
  try {
    let jobs;
    if (owner) {
      jobs = db.listJobsByOwner(owner.tenant, owner.thread, owner.turn);
      if (status) jobs = jobs.filter((j) => j.status === status);
    } else {
      jobs = db.listJobs(status);
    }
    console.log(`Jobs (${jobs.length}):`);
    for (const job of jobs) {
      console.log(
        `  ${job.id} [${job.status}] ${job.command} owner=${job.owner.tenant}/${job.owner.thread}/${job.owner.turn} exit=${job.exitCode ?? "N/A"}`
      );
    }
  } finally {
    db.close();
  }
}

async function cmdNotices(args: Record<string, string | string[]>) {
  const ledgerPath = getLedgerPath(args);
  const db = new LedgerDb(ledgerPath);
  try {
    const notices = db.listNotices();
    console.log(`Notices (${notices.length}):`);
    for (const notice of notices) {
      console.log(
        `  ${notice.id} [${notice.status}] job=${notice.jobId} owner=${notice.owner.tenant}/${notice.owner.thread}/${notice.owner.turn} attempts=${notice.attempts}`
      );
    }
  } finally {
    db.close();
  }
}

async function cmdAck(args: Record<string, string | string[]>) {
  const noticeId = String(args.notice ?? "");
  if (!noticeId) {
    console.error("Error: --notice is required");
    process.exit(1);
  }
  const ledgerPath = getLedgerPath(args);
  const db = new LedgerDb(ledgerPath);
  try {
    const service = new NoticeService(db);
    const acked = service.ack(noticeId);
    if (acked) {
      console.log(`Notice ${acked.id} acked (status: ${acked.status})`);
    } else {
      console.error(`Notice ${noticeId} not found`);
      process.exit(1);
    }
  } finally {
    db.close();
  }
}

async function cmdReplay(args: Record<string, string | string[]>) {
  const ledgerPath = getLedgerPath(args);
  const db = new LedgerDb(ledgerPath);
  try {
    const service = new NoticeService(db);
    let notices;
    if (args.tenant || args.thread || args.turn) {
      notices = service.replayUnackedByOwner(getOwner(args));
    } else {
      notices = service.replayUnacked();
    }
    console.log(`Replayed ${notices.length} unacknowledged notices:`);
    for (const notice of notices) {
      console.log(
        `  ${notice.id} -> delivered (attempt ${notice.attempts}) job=${notice.jobId}`
      );
    }
  } finally {
    db.close();
  }
}

async function cmdReap(args: Record<string, string | string[]>) {
  const ledgerPath = getLedgerPath(args);
  const db = new LedgerDb(ledgerPath);
  try {
    const reaper = new Reaper(db);
    const result = reaper.reapOrphans();
    console.log(`Reaped ${result.reaped.length} orphan job(s):`);
    for (const job of result.reaped) {
      console.log(`  ${job.id} [was ${job.status}] ${job.command}`);
    }
    console.log(`Kept ${result.kept.length} job(s) with active owner turns.`);

    const reaps = db.listReaps();
    console.log(`Total reap records: ${reaps.length}`);
    for (const r of reaps) {
      console.log(`  ${r.id} job=${r.jobId} reason=${r.reason}`);
    }
  } finally {
    db.close();
  }
}

async function cmdDemo() {
  const ledgerDir = ".local";
  const ledgerPath = path.join(ledgerDir, "agent-background-job-ledger-demo.sqlite");
  mkdirSync(ledgerDir, { recursive: true });
  console.log(`=== Agent Background Job Ledger Demo ===\n`);
  console.log(`Ledger: ${ledgerPath}\n`);

  const owner: JobOwner = {
    tenant: "demo-tenant",
    thread: "demo-thread",
    turn: "demo-turn-1",
    sandboxGeneration: "sandbox-gen-1",
  };

  const db = new LedgerDb(ledgerPath);
  try {
    // Scenario 1: Successful command
    console.log("--- Scenario 1: Successful command ---");
    const { job: job1 } = await registerAndRunJob(
      db,
      owner,
      "echo 'Build complete' && echo 'All tests passed'",
      [],
      { capturePipefail: false }
    );
    console.log(`  Job ${job1.id} status: ${job1.status} exit: ${job1.exitCode}\n`);

    // Scenario 2: Failing command with pipefail
    console.log("--- Scenario 2: Failing command (pipefail) ---");
    const { job: job2 } = await registerAndRunJob(
      db,
      owner,
      "echo 'FAIL: test_broken' && exit 1 | cat",
      [],
      { capturePipefail: true }
    );
    console.log(`  Job ${job2.id} status: ${job2.status} exit: ${job2.exitCode}\n`);

    // Scenario 3: Command with secrets to scrub
    console.log("--- Scenario 3: Secret scrubbing ---");
    const { job: job3 } = await registerAndRunJob(
      db,
      owner,
      "echo 'API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456' && echo 'token=ghp_abcdefghijklmnopqrstuvwxyz0123456789'",
      [],
      { capturePipefail: false }
    );
    console.log(`  Job ${job3.id} status: ${job3.status} exit: ${job3.exitCode}`);
    console.log(`  Scrubbed output: ${job3.stdout}\n`);

    // Deliver notices
    console.log("--- Delivering notices ---");
    const service = new NoticeService(db);
    const notices = db.listNotices();
    for (const notice of notices) {
      const delivered = service.deliver(notice.id);
      console.log(`  Delivered notice ${delivered.id} (attempt ${delivered.attempts})`);
    }
    console.log();

    // Ack first notice
    console.log("--- Acknowledging first notice ---");
    const acked = service.ack(notices[0].id);
    console.log(`  Notice ${acked?.id} acked\n`);

    // Reap: turn is still active, so nothing reaped yet
    console.log("--- Reaping orphans (turn active, nothing reaped) ---");
    const reaper = new Reaper(db);
    const reapResult = reaper.reapOrphans();
    console.log(`  Reaped: ${reapResult.reaped.length}, Kept: ${reapResult.kept.length}\n`);

    // Simulate crash: mark turn inactive
    console.log("--- Simulating crash: turn goes away ---");
    db.updateNotice(notices[0].id, { status: "pending" });
    // Deactivate the turn
    const turn = db.getTurn(owner.tenant, owner.thread, owner.turn);
    if (turn) {
      db.registerTurn({ ...turn, isActive: false });
    }
    const reapResult2 = reaper.reapOrphans();
    console.log(`  Reaped ${reapResult2.reaped.length} orphan job(s) after turn gone`);

    // Replay unacked
    console.log("\n--- Replaying unacked notices after crash ---");
    const replayed = service.replayUnacked();
    console.log(`  Replayed ${replayed.length} unacked notice(s)`);

    // Summary
    console.log("\n=== Summary ===");
    const jobs = db.listJobs();
    console.log(`Jobs: ${jobs.length}`);
    for (const j of jobs) {
      console.log(`  ${j.id} [${j.status}] exit=${j.exitCode ?? "N/A"} ${j.command.slice(0, 50)}...`);
    }
    const reaps = db.listReaps();
    console.log(`Reaps: ${reaps.length}`);
    for (const r of reaps) {
      console.log(`  job=${r.jobId} reason=${r.reason}`);
    }
  } finally {
    db.close();
  }
}

async function cmdHelp() {
  console.log(`
Agent Background Job Ledger — durable background job ledger for AI agents

Usage:
  agent-background-job-ledger <command> [options]

Commands:
  register   Register and run a command, recording a completion notice
  list       List jobs (filterable by --status, --tenant, --thread, --turn)
  notices    List notices
  ack        Acknowledge a notice (--notice <id>)
  replay     Replay unacknowledged notices (after crash)
  reap       Reap orphan jobs whose owning turn is gone
  demo       Run built-in demonstration
  help       Show this help

Common options:
  --ledger <path>        Ledger SQLite path (default: .local/agent-background-job-ledger.sqlite)
  --tenant <t>           Tenant id (default: default-tenant)
  --thread <th>          Thread id (default: default-thread)
  --turn <tu>            Turn id (default: default-turn)
  --sandbox-generation   Sandbox generation label
  --command <cmd>        Command to run (register)
  --pipefail             Wrap command with 'set -o pipefail' for accurate pipeline exit
  --status <s>           Filter by status (list)
  --notice <id>          Notice id (ack)

Examples:
  agent-background-job-ledger register --command "npm run build" --pipefail
  agent-background-job-ledger list --status running
  agent-background-job-ledger replay
  agent-background-job-ledger reap
  agent-background-job-ledger demo

About AaronWiseAI:
  AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline.
  Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (command) {
    case "register":
      await cmdRegisterAndRun(args);
      break;
    case "list":
      await cmdList(args);
      break;
    case "notices":
      await cmdNotices(args);
      break;
    case "ack":
      await cmdAck(args);
      break;
    case "replay":
      await cmdReplay(args);
      break;
    case "reap":
      await cmdReap(args);
      break;
    case "demo":
      await cmdDemo();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      await cmdHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      await cmdHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});