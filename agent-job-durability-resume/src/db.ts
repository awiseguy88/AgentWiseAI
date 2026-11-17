import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  Checkpoint,
  CreateJobInput,
  EffectRecord,
  Job,
  JobStatus,
  Step,
  StepStatus,
  WorkspaceValidation,
} from "./types.js";

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

export class SqliteDurabilityStore {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        objective TEXT NOT NULL,
        acceptance_criteria TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        current_step_id TEXT,
        checkpoint_id TEXT,
        interrupted_reason TEXT,
        resume_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        command TEXT,
        status TEXT NOT NULL,
        depends_on TEXT NOT NULL DEFAULT '[]',
        external_effect INTEGER NOT NULL DEFAULT 0,
        duplicate_guard_key TEXT,
        completed_at TEXT,
        completed_at_effect TEXT,
        stale_reason TEXT,
        order_index INTEGER NOT NULL,
        FOREIGN KEY(job_id) REFERENCES jobs(id)
      );
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        file_hashes TEXT NOT NULL,
        git_status TEXT NOT NULL,
        test_results TEXT,
        notes TEXT,
        FOREIGN KEY(job_id) REFERENCES jobs(id)
      );
      CREATE TABLE IF NOT EXISTS effects (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        effect_type TEXT NOT NULL,
        effect_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        executed_at TEXT,
        result TEXT,
        FOREIGN KEY(job_id) REFERENCES jobs(id)
      );
      CREATE TABLE IF NOT EXISTS workspace_validations (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        checkpoint_id TEXT,
        validated_at TEXT NOT NULL,
        passed INTEGER NOT NULL,
        changes_detected TEXT NOT NULL,
        stale_steps TEXT NOT NULL,
        reason TEXT,
        FOREIGN KEY(job_id) REFERENCES jobs(id)
      );
    `);
  }

  async createJob(input: CreateJobInput): Promise<Job> {
    const now = new Date().toISOString();
    const id = uid("job");
    const job: Job = {
      id,
      objective: input.objective,
      acceptanceCriteria: input.acceptanceCriteria,
      status: "running",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      currentStepId: null,
      checkpointId: null,
      interruptedReason: null,
      resumeCount: 0,
    };
    this.db
      .prepare(
        `INSERT INTO jobs (id,objective,acceptance_criteria,status,created_at,updated_at,completed_at,current_step_id,checkpoint_id,interrupted_reason,resume_count)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        job.id,
        job.objective,
        JSON.stringify(job.acceptanceCriteria),
        job.status,
        job.createdAt,
        job.updatedAt,
        job.completedAt,
        job.currentStepId,
        job.checkpointId,
        job.interruptedReason,
        job.resumeCount,
      );
    for (let i = 0; i < input.steps.length; i++) {
      const s = input.steps[i];
      await this.createStep(id, {
        name: s.name,
        description: s.description ?? null,
        type: s.type,
        command: s.command ?? null,
        status: "pending",
        dependsOn: s.dependsOn ?? [],
        externalEffect: s.externalEffect ?? false,
        duplicateGuardKey: s.duplicateGuardKey ?? null,
        completedAt: null,
        completedAtEffect: null,
        staleReason: null,
        orderIndex: i,
      });
    }
    return job;
  }

  async getJob(id: string): Promise<Job | null> {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as any;
    if (!row) return null;
    return this.rowToJob(row);
  }

  private rowToJob(row: any): Job {
    return {
      id: row.id,
      objective: row.objective,
      acceptanceCriteria: JSON.parse(row.acceptance_criteria || "[]"),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      currentStepId: row.current_step_id,
      checkpointId: row.checkpoint_id,
      interruptedReason: row.interrupted_reason,
      resumeCount: row.resume_count,
    };
  }

  async listJobs(): Promise<Job[]> {
    const rows = this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => this.rowToJob(r));
  }

  async updateJobStatus(
    id: string,
    status: JobStatus,
    opts?: { interruptedReason?: string | null; currentStepId?: string | null },
  ): Promise<void> {
    const now = new Date().toISOString();
    const cur = await this.getJob(id);
    if (!cur) throw new Error(`job not found: ${id}`);
    const interruptedReason =
      opts && opts.interruptedReason !== undefined ? opts.interruptedReason : cur.interruptedReason;
    const currentStepId =
      opts && opts.currentStepId !== undefined ? opts.currentStepId : cur.currentStepId;
    const completedAt = status === "completed" ? now : cur.completedAt;
    this.db
      .prepare(
        "UPDATE jobs SET status=?, updated_at=?, interrupted_reason=?, current_step_id=?, completed_at=? WHERE id=?",
      )
      .run(status, now, interruptedReason, currentStepId, completedAt, id);
  }

  async setCheckpointId(jobId: string, checkpointId: string): Promise<void> {
    this.db
      .prepare("UPDATE jobs SET checkpoint_id=?, updated_at=? WHERE id=?")
      .run(checkpointId, new Date().toISOString(), jobId);
  }

  async incrementResumeCount(id: string): Promise<void> {
    this.db
      .prepare("UPDATE jobs SET resume_count = resume_count + 1, updated_at=? WHERE id=?")
      .run(new Date().toISOString(), id);
  }

  async createStep(jobId: string, step: Omit<Step, "id" | "jobId">): Promise<Step> {
    const full: Step = { id: uid("step"), jobId, ...step };
    this.db
      .prepare(
        `INSERT INTO steps (id,job_id,name,description,type,command,status,depends_on,external_effect,duplicate_guard_key,completed_at,completed_at_effect,stale_reason,order_index)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        full.id,
        full.jobId,
        full.name,
        full.description,
        full.type,
        full.command,
        full.status,
        JSON.stringify(full.dependsOn),
        full.externalEffect ? 1 : 0,
        full.duplicateGuardKey,
        full.completedAt,
        full.completedAtEffect,
        full.staleReason,
        full.orderIndex,
      );
    return full;
  }

  async getSteps(jobId: string): Promise<Step[]> {
    const rows = this.db
      .prepare("SELECT * FROM steps WHERE job_id=? ORDER BY order_index ASC")
      .all(jobId) as any[];
    return rows.map((r) => this.rowToStep(r));
  }

  private rowToStep(r: any): Step {
    return {
      id: r.id,
      jobId: r.job_id,
      name: r.name,
      description: r.description,
      type: r.type,
      command: r.command,
      status: r.status,
      dependsOn: JSON.parse(r.depends_on || "[]"),
      externalEffect: r.external_effect === 1,
      duplicateGuardKey: r.duplicate_guard_key,
      completedAt: r.completed_at,
      completedAtEffect: r.completed_at_effect,
      staleReason: r.stale_reason,
      orderIndex: r.order_index,
    };
  }

  async updateStepStatus(
    id: string,
    status: StepStatus,
    opts?: { completedAt?: string | null; completedAtEffect?: string | null; staleReason?: string | null },
  ): Promise<void> {
    const currentStep = this.db.prepare("SELECT * FROM steps WHERE id=?").get(id) as any;
    if (!currentStep) throw new Error(`step not found: ${id}`);

    let completedAt = currentStep.completed_at;
    let completedAtEffect = currentStep.completed_at_effect;
    let staleReason = currentStep.stale_reason;

    if (status === "completed") {
      if (opts && opts.completedAt !== undefined) {
        completedAt = opts.completedAt;
      } else {
        completedAt = new Date().toISOString();
      }
      if (opts && opts.completedAtEffect !== undefined) {
        completedAtEffect = opts.completedAtEffect;
      }
    } else if (status === "stale") {
      if (opts && opts.staleReason !== undefined) {
        staleReason = opts.staleReason;
      }
    } else if (status === "pending" || status === "failed") {
      completedAt = null;
      completedAtEffect = null;
      staleReason = null;
    }

    this.db
      .prepare("UPDATE steps SET status=?, completed_at=?, completed_at_effect=?, stale_reason=? WHERE id=?")
      .run(status, completedAt, completedAtEffect, staleReason, id);
  }

  async createCheckpoint(
    jobId: string,
    stepId: string,
    cp: Omit<Checkpoint, "id" | "jobId" | "stepId" | "capturedAt">,
  ): Promise<Checkpoint> {
    const now = new Date().toISOString();
    const full: Checkpoint = {
      id: uid("cp"),
      jobId,
      stepId,
      capturedAt: now,
      ...cp,
    };
    this.db
      .prepare(
        `INSERT INTO checkpoints (id,job_id,step_id,captured_at,file_hashes,git_status,test_results,notes)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        full.id,
        full.jobId,
        full.stepId,
        full.capturedAt,
        JSON.stringify(full.fileHashes),
        full.gitStatus,
        full.testResults,
        full.notes,
      );
    await this.setCheckpointId(jobId, full.id);
    return full;
  }

  async getLatestCheckpoint(jobId: string): Promise<Checkpoint | null> {
    const row = this.db
      .prepare("SELECT * FROM checkpoints WHERE job_id=? ORDER BY captured_at DESC LIMIT 1")
      .get(jobId) as any;
    if (!row) return null;
    return this.rowToCheckpoint(row);
  }

  async getCheckpoint(id: string): Promise<Checkpoint | null> {
    const row = this.db.prepare("SELECT * FROM checkpoints WHERE id=?").get(id) as any;
    if (!row) return null;
    return this.rowToCheckpoint(row);
  }

  private rowToCheckpoint(r: any): Checkpoint {
    return {
      id: r.id,
      jobId: r.job_id,
      stepId: r.step_id,
      capturedAt: r.captured_at,
      fileHashes: JSON.parse(r.file_hashes || "[]"),
      gitStatus: r.git_status,
      testResults: r.test_results,
      notes: r.notes,
    };
  }

  async recordEffect(
    jobId: string,
    stepId: string,
    effect: Omit<EffectRecord, "id" | "jobId" | "stepId" | "executedAt">,
  ): Promise<EffectRecord> {
    const now = new Date().toISOString();
    const full: EffectRecord = { id: uid("eff"), jobId, stepId, executedAt: now, ...effect };
    this.db
      .prepare(
        `INSERT INTO effects (id,job_id,step_id,effect_type,effect_key,status,executed_at,result)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(effect_key) DO NOTHING`,
      )
      .run(
        full.id,
        full.jobId,
        full.stepId,
        full.effectType,
        full.effectKey,
        full.status,
        full.executedAt,
        full.result,
      );
    const row = this.db.prepare("SELECT * FROM effects WHERE effect_key=?").get(full.effectKey) as any;
    if (!row) throw new Error(`failed to record effect ${full.effectKey}`);
    return this.rowToEffect(row);
  }

  async findEffectByKey(effectKey: string): Promise<EffectRecord | null> {
    const row = this.db.prepare("SELECT * FROM effects WHERE effect_key=?").get(effectKey) as any;
    return row ? this.rowToEffect(row) : null;
  }

  async listEffects(jobId: string): Promise<EffectRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM effects WHERE job_id=? ORDER BY executed_at ASC")
      .all(jobId) as any[];
    return rows.map((r) => this.rowToEffect(r));
  }

  async markEffectCompleted(effectId: string, result: string): Promise<void> {
    this.db
      .prepare("UPDATE effects SET status='completed', executed_at=?, result=? WHERE id=?")
      .run(new Date().toISOString(), result, effectId);
  }

  private rowToEffect(r: any): EffectRecord {
    return {
      id: r.id,
      jobId: r.job_id,
      stepId: r.step_id,
      effectType: r.effect_type,
      effectKey: r.effect_key,
      status: r.status,
      executedAt: r.executed_at,
      result: r.result,
    };
  }

  async recordWorkspaceValidation(
    jobId: string,
    validation: Omit<WorkspaceValidation, "id" | "jobId" | "validatedAt">,
  ): Promise<WorkspaceValidation> {
    const now = new Date().toISOString();
    const full: WorkspaceValidation = {
      id: uid("wval"),
      jobId,
      validatedAt: now,
      ...validation,
    };
    this.db
      .prepare(
        `INSERT INTO workspace_validations (id,job_id,checkpoint_id,validated_at,passed,changes_detected,stale_steps,reason)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        full.id,
        full.jobId,
        full.checkpointId,
        full.validatedAt,
        full.passed ? 1 : 0,
        JSON.stringify(full.changesDetected),
        JSON.stringify(full.staleSteps),
        full.reason,
      );
    return full;
  }

  async listWorkspaceValidations(jobId: string): Promise<WorkspaceValidation[]> {
    const rows = this.db
      .prepare("SELECT * FROM workspace_validations WHERE job_id=? ORDER BY validated_at ASC")
      .all(jobId) as any[];
    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      checkpointId: r.checkpoint_id,
      validatedAt: r.validated_at,
      passed: r.passed === 1,
      changesDetected: JSON.parse(r.changes_detected || "[]"),
      staleSteps: JSON.parse(r.stale_steps || "[]"),
      reason: r.reason,
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}