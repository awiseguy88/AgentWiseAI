import { spawn } from "node:child_process";
import { LedgerDb } from "./db.js";
import { scrubOutput } from "./scrub.js";
import { JobOwner, JobRecord, NoticePayload } from "./types.js";

/**
 * Run a command, capturing stdout/stderr and true exit status.
 * Uses `bash -c` so pipelines like `cargo test | tail` propagate
 * the failing stage's exit code via `set -o pipefail` (opt-in).
 * To detect the *true* failing stage in a pipeline, callers should
 * pass the command as: `set -o pipefail; cargo test | tail`
 * or use PIPESTATUS logic. We return the shell's exit code.
 */
export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  capturePipefail?: boolean; // wrap in `set -o pipefail; ...`
}

export async function runCommand(
  db: LedgerDb,
  job: JobRecord,
  opts: RunCommandOptions = {}
): Promise<JobRecord> {
  db.updateJob(job.id, { status: "running" });

  const command = opts.capturePipefail
    ? `set -o pipefail; ${job.command}`
    : job.command;

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let finished = false;

    const proc = spawn("bash", ["-c", command], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const finalize = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (finished) return;
      finished = true;
      const finishedAt = new Date().toISOString();
      const scrubbedStdout = scrubOutput(stdout);
      const scrubbedStderr = scrubOutput(stderr);
      const status = exitCode === 0 ? "completed" : "failed";
      db.updateJob(job.id, {
        status,
        exitCode: exitCode ?? undefined,
        signal: signal ?? undefined,
        stdout: scrubbedStdout,
        stderr: scrubbedStderr,
        finishedAt,
      });
      const updated = db.getJob(job.id)!;
      resolve(updated);
    };

    proc.on("error", (err) => {
      stderr += `\n[spawn error] ${err.message}`;
      finalize(1, null);
    });

    proc.on("close", (code, signal) => {
      finalize(code, signal);
    });

    if (opts.timeoutMs) {
      setTimeout(() => {
        if (!finished) {
          proc.kill("SIGTERM");
          stderr += "\n[timeout] command exceeded timeout and was terminated";
        }
      }, opts.timeoutMs);
    }
  });
}

/**
 * Register and run a job end-to-end, recording a notice on completion.
 */
export async function registerAndRunJob(
  db: LedgerDb,
  owner: JobOwner,
  command: string,
  args: string[] = [],
  opts: RunCommandOptions & { commandOverride?: string } = {}
): Promise<{ job: JobRecord; noticeId: string }> {
  // Ensure turn exists
  const existingTurn = db.getTurn(owner.tenant, owner.thread, owner.turn);
  if (!existingTurn) {
    db.registerTurn({
      id: `${owner.tenant}:${owner.thread}:${owner.turn}`,
      tenant: owner.tenant,
      thread: owner.thread,
      turn: owner.turn,
      sandboxGeneration: owner.sandboxGeneration,
      lastSeenAt: new Date().toISOString(),
      isActive: true,
    });
  } else {
    db.updateTurnActivity(owner.tenant, owner.thread, owner.turn);
  }

  const job = db.registerJob(owner, command, args, "registered");
  const completedJob = await runCommand(db, job, opts);

  const payload: NoticePayload = {
    jobId: completedJob.id,
    status: completedJob.status,
    exitCode: completedJob.exitCode,
    signal: completedJob.signal,
    stdout: completedJob.stdout,
    stderr: completedJob.stderr,
    finishedAt: completedJob.finishedAt ?? new Date().toISOString(),
  };
  const notice = db.recordNotice(completedJob.id, owner, payload, "pending");

  return { job: completedJob, noticeId: notice.id };
}