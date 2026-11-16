// Core domain types for the Agent Decision Triage app.

export type DecisionType = "question" | "approval" | "review" | "done-claim";

export type ItemStatus =
  | "pending"
  | "resolved"
  | "snoozed"
  | "needs-info"
  | "failed";

export type DeliveryChannel = "callback" | "file" | "socket";

export interface ContextLink {
  label: string;
  url: string;
  snippet?: string;
}

export interface DiffSnippet {
  path: string;
  before?: string;
  after: string;
  hunks?: string[];
}

export interface SubmitContext {
  summary: string;
  links?: ContextLink[];
  diff?: DiffSnippet;
  agent?: string;
  session?: string;
  prompt?: string;
  [key: string]: unknown;
}

export interface SubmitItem {
  type: DecisionType;
  context: SubmitContext;
  channel: DeliveryChannel;
  channelTarget: string;
  priority?: number;
  dedupeKey?: string;
  // Optional explicit response expectation; informational only.
  expected?: string[];
}

export interface DeliverySpec {
  channel: DeliveryChannel;
  target: string;
}

export interface DecisionItem {
  id: number;
  type: DecisionType;
  status: ItemStatus;
  priority: number;
  source: string | null;
  session: string | null;
  summary: string;
  context: SubmitContext;
  channel: DeliveryChannel;
  channelTarget: string;
  dedupeKey: string | null;
  linkedTo: number | null;
  duplicateGroup: number | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  response: unknown | null;
  deliveryAttempts: number;
  deliveryError: string | null;
  snoozeUntil: string | null;
  needsInfoQuestion: string | null;
}

export interface AuditRecord {
  id: number;
  itemId: number;
  action: string;
  actor: string | null;
  detail: string | null;
  createdAt: string;
}

export interface ResolvePayload {
  response: unknown;
  responder?: string;
}

export interface SnoozePayload {
  until?: string;
  reason?: string;
}

export interface NeedsInfoPayload {
  question: string;
}

export interface BatchResolvePayload {
  resolutions: Array<{ id: number; response: unknown; responder?: string }>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface DeliveryDiagnostic {
  code: string;
  message: string;
  attempts: number;
  lastError?: string;
}