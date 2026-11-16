import { DatabaseSync, StatementSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  JobRecord,
  NoticeRecord,
  TurnRecord,
  ReapRecord,
  JobStatus,
  NoticeStatus,
  NoticePayload,
  JobOwner,
} from "./types.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  thread TEXT NOT NULL,
  turn TEXT NOT NULL,
  sandbox_generation TEXT,
  last_seen_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  thread TEXT NOT NULL,
  turn TEXT NOT NULL,
  sandbox_generation TEXT,
  command TEXT NOT NULL,
  args TEXT NOT NULL,
  status TEXT NOT NULL,
  exit_code INTEGER,
  signal TEXT,
  stdout TEXT NOT NULL DEFAULT '',
  stderr TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  tenant TEXT NOT NULL,
  thread TEXT NOT NULL,
  turn TEXT NOT NULL,
  sandbox_generation TEXT,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  acked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reaps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  reaped_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(tenant, thread, turn);
CREATE INDEX IF NOT EXISTS idx_notices_status ON notices(status);
CREATE INDEX IF NOT EXISTS idx_notices_owner ON notices(tenant, thread, turn);
`;

export class LedgerDb {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA_SQL);
  }

  close(): void {
    this.db.close();
  }

  // --- Turns ---
  registerTurn(turn: TurnRecord): TurnRecord {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO turns
         (id, tenant, thread, turn, sandbox_generation, last_seen_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        turn.id,
        turn.tenant,
        turn.thread,
        turn.turn,
        turn.sandboxGeneration ?? null,
        turn.lastSeenAt,
        turn.isActive ? 1 : 0
      );
    return turn;
  }

  getTurn(tenant: string, thread: string, turn: string): TurnRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM turns WHERE tenant=? AND thread=? AND turn=?`
      )
      .get(tenant, thread, turn) as any;
    return row ? this.rowToTurn(row) : null;
  }

  updateTurnActivity(tenant: string, thread: string, turn: string): void {
    const existing = this.getTurn(tenant, thread, turn);
    if (!existing) return;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE turns SET last_seen_at=?, is_active=1 WHERE id=?`
      )
      .run(now, existing.id);
  }

  listActiveTurns(): TurnRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM turns WHERE is_active=1`)
      .all() as any[];
    return rows.map(this.rowToTurn);
  }

  // --- Jobs ---
  registerJob(
    owner: JobOwner,
    command: string,
    args: string[],
    status: JobStatus = "registered"
  ): JobRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const job: JobRecord = {
      id,
      owner,
      command,
      args,
      status,
      stdout: "",
      stderr: "",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO jobs
         (id, tenant, thread, turn, sandbox_generation, command, args, status,
          exit_code, signal, stdout, stderr, started_at, finished_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '', '', ?, NULL, ?, ?)`
      )
      .run(
        id,
        owner.tenant,
        owner.thread,
        owner.turn,
        owner.sandboxGeneration ?? null,
        command,
        JSON.stringify(args),
        status,
        now,
        now,
        now
      );
    return job;
  }

  updateJob(
    id: string,
    updates: Partial<{
      status: JobStatus;
      exitCode: number | undefined;
      signal: string | undefined;
      stdout: string;
      stderr: string;
      finishedAt: string | undefined;
    }>
  ): void {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.status !== undefined) { fields.push("status=?"); values.push(updates.status); }
    if (updates.exitCode !== undefined) { fields.push("exit_code=?"); values.push(updates.exitCode); }
    if (updates.signal !== undefined) { fields.push("signal=?"); values.push(updates.signal); }
    if (updates.stdout !== undefined) { fields.push("stdout=?"); values.push(updates.stdout); }
    if (updates.stderr !== undefined) { fields.push("stderr=?"); values.push(updates.stderr); }
    if (updates.finishedAt !== undefined) { fields.push("finished_at=?"); values.push(updates.finishedAt); }
    fields.push("updated_at=?"); values.push(now);
    values.push(id);
    this.db
      .prepare(`UPDATE jobs SET ${fields.join(", ")} WHERE id=?`)
      .run(...values);
  }

  getJob(id: string): JobRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM jobs WHERE id=?`)
      .get(id) as any;
    return row ? this.rowToJob(row) : null;
  }

  listJobs(status?: JobStatus): JobRecord[] {
    const rows = status
      ? (this.db.prepare(`SELECT * FROM jobs WHERE status=?`).all(status) as any[])
      : (this.db.prepare(`SELECT * FROM jobs`).all() as any[]);
    return rows.map(this.rowToJob);
  }

  listJobsByOwner(tenant: string, thread: string, turn: string): JobRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM jobs WHERE tenant=? AND thread=? AND turn=?`)
      .all(tenant, thread, turn) as any[];
    return rows.map(this.rowToJob);
  }

  // --- Notices ---
  recordNotice(
    jobId: string,
    owner: JobOwner,
    payload: NoticePayload,
    status: NoticeStatus = "pending"
  ): NoticeRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const notice: NoticeRecord = {
      id,
      jobId,
      owner,
      status,
      payload,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO notices
         (id, job_id, tenant, thread, turn, sandbox_generation, status, payload, attempts,
          last_attempt_at, acked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?)`
      )
      .run(
        id,
        jobId,
        owner.tenant,
        owner.thread,
        owner.turn,
        owner.sandboxGeneration ?? null,
        status,
        JSON.stringify(payload),
        now,
        now
      );
    return notice;
  }

  updateNotice(
    id: string,
    updates: Partial<{
      status: NoticeStatus;
      attempts: number;
      lastAttemptAt: string | undefined;
      ackedAt: string | undefined;
    }>
  ): void {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.status !== undefined) { fields.push("status=?"); values.push(updates.status); }
    if (updates.attempts !== undefined) { fields.push("attempts=?"); values.push(updates.attempts); }
    if (updates.lastAttemptAt !== undefined) { fields.push("last_attempt_at=?"); values.push(updates.lastAttemptAt); }
    if (updates.ackedAt !== undefined) { fields.push("acked_at=?"); values.push(updates.ackedAt); }
    fields.push("updated_at=?"); values.push(now);
    values.push(id);
    this.db
      .prepare(`UPDATE notices SET ${fields.join(", ")} WHERE id=?`)
      .run(...values);
  }

  getNotice(id: string): NoticeRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM notices WHERE id=?`)
      .get(id) as any;
    return row ? this.rowToNotice(row) : null;
  }

  listNotices(status?: NoticeStatus): NoticeRecord[] {
    const rows = status
      ? (this.db.prepare(`SELECT * FROM notices WHERE status=?`).all(status) as any[])
      : (this.db.prepare(`SELECT * FROM notices`).all() as any[]);
    return rows.map(this.rowToNotice);
  }

  listUnackedNotices(): NoticeRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM notices WHERE status IN ('pending', 'failed')`)
      .all() as any[];
    return rows.map(this.rowToNotice);
  }

  // --- Reaps ---
  recordReap(jobId: string, reason: ReapRecord["reason"]): ReapRecord {
    const id = randomUUID();
    const reapedAt = new Date().toISOString();
    const reap: ReapRecord = { id, jobId, reason, reapedAt };
    this.db
      .prepare(`INSERT INTO reaps (id, job_id, reason, reaped_at) VALUES (?, ?, ?, ?)`)
      .run(id, jobId, reason, reapedAt);
    return reap;
  }

  listReaps(): ReapRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM reaps ORDER BY reaped_at`)
      .all() as any[];
    return rows.map((r) => ({ id: r.id, jobId: r.job_id, reason: r.reason, reapedAt: r.reaped_at }));
  }

  // --- Row mappers ---
  private rowToTurn(row: any): TurnRecord {
    return {
      id: row.id,
      tenant: row.tenant,
      thread: row.thread,
      turn: row.turn,
      sandboxGeneration: row.sandbox_generation ?? undefined,
      lastSeenAt: row.last_seen_at,
      isActive: row.is_active === 1,
    };
  }

  private rowToJob(row: any): JobRecord {
    return {
      id: row.id,
      owner: {
        tenant: row.tenant,
        thread: row.thread,
        turn: row.turn,
        sandboxGeneration: row.sandbox_generation ?? undefined,
      },
      command: row.command,
      args: JSON.parse(row.args),
      status: row.status as JobStatus,
      exitCode: row.exit_code ?? undefined,
      signal: row.signal ?? undefined,
      stdout: row.stdout,
      stderr: row.stderr,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToNotice(row: any): NoticeRecord {
    return {
      id: row.id,
      jobId: row.job_id,
      owner: {
        tenant: row.tenant,
        thread: row.thread,
        turn: row.turn,
        sandboxGeneration: row.sandbox_generation ?? undefined,
      },
      status: row.status as NoticeStatus,
      payload: JSON.parse(row.payload) as NoticePayload,
      attempts: row.attempts,
      lastAttemptAt: row.last_attempt_at ?? undefined,
      ackedAt: row.acked_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}