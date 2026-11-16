import { createHash } from "node:crypto";

export function schemaHash(schema: unknown): string {
  const json = JSON.stringify(schema ?? null);
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

export function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

export function estimateTokensFromBytes(bytes: number): number {
  // Simple heuristic: ~4 chars/bytes per token for JSON-ish payloads.
  return Math.max(1, Math.ceil(bytes / 4));
}
