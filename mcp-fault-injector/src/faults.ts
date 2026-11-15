// Fault injection for MCP-like JSON-RPC / result payloads.
//
// Faults are applied to responses travelling from the MCP server back to the
// MCP client/agent, so the tool can test how agents behave under failing
// servers without modifying either side.

export type FaultName = "latency" | "timeout" | "invalidJson" | "missingFields" | "truncated";

export interface FaultConfig {
  /** Fraction of matching responses to corrupt (0..1). Default 1. */
  rate?: number;
  /** Match only responses for these method names; undefined = all. */
  methods?: string[];
  /** Milliseconds delay before forwarding response. */
  latencyMs?: number;
  /** When true, drop the response entirely (client observes a hang/timeout). */
  drop?: boolean;
  /** When true, replace response body with invalid JSON. */
  invalidJson?: boolean;
  /** Field paths to strip from result objects. */
  removePaths?: string[];
  /** Max bytes/characters to keep of string results. */
  truncateTo?: number;
  /** Sentinal object inserted when invalid JSON / missing fields (optional diagnostic marker). */
  marker?: string;
}

export interface FaultRule {
  name: FaultName;
  enabled: boolean;
  config: Required<FaultConfig>;
}

export const DEFAULT_RULES: FaultRule[] = [
  { name: "latency", enabled: true, config: { rate: 1, methods: [], latencyMs: 800, drop: false, invalidJson: false, removePaths: [], truncateTo: 0, marker: "fault-injected" } },
  { name: "timeout", enabled: true, config: { rate: 1, methods: [], latencyMs: 0, drop: true, invalidJson: false, removePaths: [], truncateTo: 0, marker: "fault-injected" } },
  { name: "invalidJson", enabled: true, config: { rate: 1, methods: [], latencyMs: 0, drop: false, invalidJson: true, removePaths: [], truncateTo: 0, marker: "fault-injected" } },
  { name: "missingFields", enabled: true, config: { rate: 1, methods: [], latencyMs: 0, drop: false, invalidJson: false, removePaths: ["content", "text"], truncateTo: 0, marker: "fault-injected" } },
  { name: "truncated", enabled: true, config: { rate: 1, methods: [], latencyMs: 0, drop: false, invalidJson: false, removePaths: [], truncateTo: 40, marker: "fault-injected" } },
];

/** Does this rule match a response for the given method? */
export function matchesMethod(config: FaultConfig, method: string | undefined): boolean {
  if (!config.methods || config.methods.length === 0) return true;
  return config.methods.includes(method ?? "");
}

/** Transform a response payload object according to the configured faults.
 *
 * Applies one matching enabled rule, chosen by rate. Returns either:
 *  - { type: "response", payload }  (forward this, possibly modified/delayed/dropped)
 *  - { type: "drop" }               (never forward: client times out)
 *  - { type: "invalidJson" }        (send garbage bytes instead of JSON)
 * Each call mutates nothing: the caller re-serializes the payload.
 */
export function applyFaults(
  rules: FaultRule[],
  method: string | undefined,
  payload: unknown,
  rng: () => number,
): { type: "response" | "drop" | "invalidJson"; payload?: unknown; delayMs?: number } {
  const candidates = rules.filter((r) => r.enabled && matchesMethod(r.config, method));
  if (candidates.length === 0) return { type: "response", payload };

  // Randomly pick one enabled candidate per response for realism; rate gates it.
  const pick = candidates[Math.floor(rng() * candidates.length)];
  const c = pick.config;

  if (rng() > c.rate) return { type: "response", payload };

  if (c.drop) return { type: "drop" };

  if (c.invalidJson) return { type: "invalidJson" };

  let transformed = payload;
  if (c.removePaths && c.removePaths.length > 0 && typeof transformed === "object" && transformed !== null) {
    transformed = stripPaths(transformed, c.removePaths);
  }
  if (c.truncateTo && c.truncateTo > 0 && typeof transformed === "string") {
    transformed = transformed.slice(0, c.truncateTo);
  }

  let delayMs: number | undefined;
  if (c.latencyMs && c.latencyMs > 0) delayMs = c.latencyMs;

  return { type: "response", payload: transformed, delayMs };
}

/** Remove dot-notation paths from a plain object/array, mutating a copy. */
function stripPaths(obj: unknown, paths: string[]): unknown {
  if (obj == null || typeof obj !== "object") return obj;
  const copy: unknown = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = copy;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (cur == null || typeof cur !== "object") break;
      cur = (cur as Record<string, unknown>)[key];
    }
    const last = parts[parts.length - 1];
    if (cur != null && typeof cur === "object" && !Array.isArray(cur)) {
      delete (cur as Record<string, unknown>)[last];
    }
  }
  return copy;
}
