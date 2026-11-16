/** Shared types for Agent Background Job Ledger */

export type JobStatus =
  | "registered"
  | "running"
  | "completed"
  | "failed"
  | "reaped";

export type NoticeStatus =
  | "pending"
  | "delivered"
  | "acked"
  | "failed";

export interface JobOwner {
  tenant: string;
  thread: string;
  turn: string;
  sandboxGeneration?: string;
}

export interface JobRecord {
  id: string;
  owner: JobOwner;
  command: string;
  args: string[];
  status: JobStatus;
  exitCode?: number;
  signal?: string;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeRecord {
  id: string;
  jobId: string;
  owner: JobOwner;
  status: NoticeStatus;
  payload: NoticePayload;
  attempts: number;
  lastAttemptAt?: string;
  ackedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticePayload {
  jobId: string;
  status: JobStatus;
  exitCode?: number;
  signal?: string;
  stdout: string;
  stderr: string;
  finishedAt: string;
}

export interface TurnRecord {
  id: string;
  tenant: string;
  thread: string;
  turn: string;
  sandboxGeneration?: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface ReapRecord {
  id: string;
  jobId: string;
  reason: "turn_gone" | "sandbox_expired" | "manual";
  reapedAt: string;
}

export interface CliOptions {
  ledger?: string;
  tenant?: string;
  thread?: string;
  turn?: string;
  command?: string;
  args?: string[];
  jobId?: string;
}

export interface RunResult {
  job: JobRecord;
  notice?: NoticeRecord;
}

export interface ScrubOptions {
  maxBytes: number;
  redactPatterns: RegExp[];
}