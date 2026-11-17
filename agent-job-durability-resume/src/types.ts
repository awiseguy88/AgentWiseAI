export type JobStatus =
  | "running"
  | "suspended"
  | "recovering"
  | "blocked"
  | "unfinished"
  | "completed"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "skipped"
  | "stale";

export type StepType = "edit" | "build" | "test" | "command";

export type EffectStatus = "completed" | "pending" | "uncertain";

export interface FileHashEntry {
  path: string;
  hash: string; // sha256 hex
  size: number;
}

export interface Checkpoint {
  id: string;
  jobId: string;
  stepId: string;
  capturedAt: string;
  fileHashes: FileHashEntry[];
  gitStatus: string; // `git --no-porcelain status` output serialized
  testResults: string | null; // last test command output / summary
  notes: string | null;
}

export interface Step {
  id: string;
  jobId: string;
  name: string;
  description: string | null;
  type: StepType;
  command: string | null; // shell command for build/test/command steps
  status: StepStatus;
  dependsOn: string[]; // step ids this step depends on
  externalEffect: boolean; // true if step produces an external side effect
  duplicateGuardKey: string | null; // key to detect replay of completed effect
  completedAt: string | null;
  completedAtEffect: string | null; // snapshot of effect at completion
  staleReason: string | null; // why step was marked stale on resume
  orderIndex: number;
}

export interface Job {
  id: string;
  objective: string;
  acceptanceCriteria: string[]; // criteria that must pass for completion
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  currentStepId: string | null;
  checkpointId: string | null; // latest checkpoint
  interruptedReason: string | null;
  resumeCount: number;
}

export interface EffectRecord {
  id: string;
  jobId: string;
  stepId: string;
  effectType: string; // e.g. "file-edit", "build-artifact", "npm-install"
  effectKey: string; // stable key identifying the effect (path + content hash)
  status: EffectStatus;
  executedAt: string | null;
  result: string | null; // outcome snapshot
}

export interface WorkspaceValidation {
  id: string;
  jobId: string;
  checkpointId: string | null;
  validatedAt: string;
  passed: boolean;
  changesDetected: string[]; // paths that changed vs checkpoint
  staleSteps: string[]; // step ids marked stale
  reason: string | null;
}

export interface ResumePlan {
  job: Job;
  validation: WorkspaceValidation;
  completedSteps: Step[];
  pendingSteps: Step[];
  staleSteps: Step[];
  replaySkipped: string[]; // step ids whose completed effect must not be replayed
  actions: string[]; // human-readable planned actions
}

export interface CreateJobInput {
  objective: string;
  acceptanceCriteria: string[];
  steps: Array<{
    name: string;
    description?: string | null;
    type: StepType;
    command?: string | null;
    dependsOn?: string[];
    externalEffect?: boolean;
    duplicateGuardKey?: string | null;
  }>;
}

export interface DurabilityStore {
  // jobs
  createJob(input: CreateJobInput): Promise<Job>;
  getJob(id: string): Promise<Job | null>;
  listJobs(): Promise<Job[]>;
  updateJobStatus(
    id: string,
    status: JobStatus,
    opts?: { interruptedReason?: string | null; currentStepId?: string | null },
  ): Promise<void>;
  setCheckpointId(jobId: string, checkpointId: string): Promise<void>;
  incrementResumeCount(id: string): Promise<void>;
  // steps
  createStep(jobId: string, step: Omit<Step, "id" | "jobId">): Promise<Step>;
  getSteps(jobId: string): Promise<Step[]>;
  updateStepStatus(id: string, status: StepStatus, opts?: {
    completedAt?: string | null;
    completedAtEffect?: string | null;
    staleReason?: string | null;
  }): Promise<void>;
  // checkpoints
  createCheckpoint(
    jobId: string,
    stepId: string,
    cp: Omit<Checkpoint, "id" | "jobId" | "stepId" | "capturedAt">,
  ): Promise<Checkpoint>;
  getLatestCheckpoint(jobId: string): Promise<Checkpoint | null>;
  getCheckpoint(id: string): Promise<Checkpoint | null>;
  // effects
  recordEffect(
    jobId: string,
    stepId: string,
    effect: Omit<EffectRecord, "id" | "jobId" | "stepId" | "executedAt">,
  ): Promise<EffectRecord>;
  findEffectByKey(effectKey: string): Promise<EffectRecord | null>;
  listEffects(jobId: string): Promise<EffectRecord[]>;
  markEffectCompleted(effectId: string, result: string): Promise<void>;
  // workspace validation
  recordWorkspaceValidation(
    jobId: string,
    validation: Omit<WorkspaceValidation, "id" | "jobId" | "validatedAt">,
  ): Promise<WorkspaceValidation>;
  listWorkspaceValidations(jobId: string): Promise<WorkspaceValidation[]>;
  // lifecycle
  close(): Promise<void>;
}


