import { LedgerDb } from "./db.js";
import { JobRecord, TurnRecord } from "./types.js";

/**
 * Reap orphan jobs whose owning turn is gone (not active or missing).
 * Surfaces them via `listReaps` (dashboard reads this table).
 */
export class Reaper {
  constructor(private db: LedgerDb) {}

  /** Reap jobs whose turn no longer exists or is inactive. */
  reapOrphans(): ReapResult {
    const activeTurnKeys = new Set(
      this.db.listActiveTurns().map((t) => `${t.tenant}:${t.thread}:${t.turn}`)
    );

    const jobs = this.db.listJobs().filter(
      (j) => j.status !== "reaped"
    );

    const reaped: JobRecord[] = [];
    const kept: JobRecord[] = [];

    for (const job of jobs) {
      const key = `${job.owner.tenant}:${job.owner.thread}:${job.owner.turn}`;
      const turnExists = activeTurnKeys.has(key);

      if (!turnExists) {
        this.db.updateJob(job.id, { status: "reaped" });
        this.db.recordReap(job.id, "turn_gone");
        reaped.push(job);
      } else {
        kept.push(job);
      }
    }

    return { reaped, kept };
  }

  /** Reap a single job by id (manual intervention). */
  reapJob(jobId: string): JobRecord | null {
    const job = this.db.getJob(jobId);
    if (!job || job.status === "reaped") return job;
    this.db.updateJob(job.id, { status: "reaped" });
    this.db.recordReap(job.id, "manual");
    return this.db.getJob(jobId);
  }
}

export interface ReapResult {
  reaped: JobRecord[];
  kept: JobRecord[];
}

export interface ReapedJob {
  id: string;
  jobId: string;
  reason: string;
  reapedAt: string;
}