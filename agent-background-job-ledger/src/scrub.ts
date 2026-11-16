import { ScrubOptions } from "./types.js";

const DEFAULT_MAX_BYTES = 16 * 1024; // 16KB

const DEFAULT_REDACT_PATTERNS: RegExp[] = [
  /(?:(?:api|secret|access)[_-]?key|token|password|passwd|bearer)[\s:=]+[^\s"']+/gi,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bghp_[A-Za-z0-9]{36,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g,
];

export function scrubOutput(
  input: string,
  opts?: Partial<ScrubOptions>
): string {
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const patterns = opts?.redactPatterns ?? DEFAULT_REDACT_PATTERNS;

  let result = input;

  // Redact secrets
  for (const pattern of patterns) {
    // reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }

  // Bound to maxBytes (UTF-8 bytes)
  const encoder = new TextEncoder();
  const encoded = encoder.encode(result);
  if (encoded.length > maxBytes) {
    const truncated = encoded.slice(0, maxBytes);
    const decoder = new TextDecoder();
    result = decoder.decode(truncated);
    // Remove partial character at end
    result = result.replace(/\uFFFD$/, "");
    result += `\n... [truncated, total ${encoded.length} bytes]`;
  }

  return result;
}