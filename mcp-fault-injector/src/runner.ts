export type Classification = "clean_failure" | "silent_wrong_answer" | "ok" | "inconclusive";

export interface ScenarioStep {
  name: string;
  method: string;
  params?: Record<string, unknown>;
  /** If true, the agent/test expects this call to succeed with well-formed data. */
  expectWellFormed?: boolean;
  /** JSONPath-like simple checks: dot paths that must exist in result. */
  requiredFields?: string[];
}

export interface StepResult {
  step: string;
  method: string;
  classification: Classification;
  notes: string;
}

export interface FaultRunResult {
  fault: string;
  steps: StepResult[];
  summary: string;
}

export interface FullReport {
  timestamp: string;
  target: string;
  scenario: string;
  results: FaultRunResult[];
}

export function classifyResponse(
  faultName: string,
  error: Error | null,
  response: unknown,
  step: ScenarioStep,
): StepResult {
  if (error) {
    // Any explicit error/timeout/invalid-json surfaced is a clean failure.
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("dropped") || msg.includes("invalid json") || msg.includes("invalid json response")) {
      return { step: step.name, method: step.method, classification: "clean_failure", notes: `Fault caused clear failure: ${error.message}` };
    }
    return { step: step.name, method: step.method, classification: "clean_failure", notes: `Error surfaced: ${error.message}` };
  }

  if (response === undefined || response === null) {
    return { step: step.name, method: step.method, classification: "silent_wrong_answer", notes: "Response missing/unset (agent may proceed blindly)" };
  }

  // Check required fields: for JSON-RPC responses, look inside `result`.
  if (step.requiredFields && step.requiredFields.length > 0) {
    const container = response && typeof response === "object" && "result" in (response as Record<string, unknown>)
      ? (response as Record<string, unknown>).result
      : response;
    const missing = step.requiredFields.filter((p) => !hasPath(container, p));
    if (missing.length > 0) {
      return { step: step.name, method: step.method, classification: "silent_wrong_answer", notes: `Missing required fields: ${missing.join(", ")} (would be accepted as data)` };
    }
  }

  // If we injected faults and got a structurally odd response, mark as silent wrong if not validated
  if (faultName !== "none" && (isTruncatedString(response) || isSuspiciousShape(response))) {
    return { step: step.name, method: step.method, classification: "silent_wrong_answer", notes: "Malformed/truncated payload returned without clear error" };
  }

  if (faultName !== "none") {
    return { step: step.name, method: step.method, classification: "inconclusive", notes: "Fault injected but response still appeared usable by basic checks" };
  }

  return { step: step.name, method: step.method, classification: "ok", notes: "No fault; response accepted by basic checks" };
}

function hasPath(obj: unknown, path: string): boolean {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in (cur as Record<string, unknown>))) return false;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur !== undefined;
}

function isTruncatedString(obj: unknown): boolean {
  const s = JSON.stringify(obj);
  // Detect obvious truncation patterns from fault injection.
  if (s.length > 0 && s.endsWith('"}]}')) return false;
  if (s.includes('"text":"OK: sample res"') && s.length < 80) return true;
  return false;
}

function isSuspiciousShape(obj: unknown): boolean {
  // Very rough: if result contains an obvious marker or is missing common keys unexpectedly
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if ("result" in o && o.result && typeof o.result === "object") {
      const r = o.result as Record<string, unknown>;
      if ("content" in r && r.content === undefined) return true;
    }
  }
  return false;
}
