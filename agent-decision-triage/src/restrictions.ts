import fs from "fs";
import path from "path";
import type { DeliveryDiagnostic } from "./types";

export interface DeliveryRestrictions {
  baseDir: string;
  allowExternalCallback: boolean;
  allowExternalFile: boolean;
  allowExternalSocket: boolean;
}

export function defaultRestrictions(): DeliveryRestrictions {
  return {
    baseDir: path.join(process.cwd(), ".local", "delivery"),
    allowExternalCallback: false,
    allowExternalFile: false,
    allowExternalSocket: false,
  };
}

export function resolveRestrictions(env: NodeJS.ProcessEnv = process.env): DeliveryRestrictions {
  const baseDir = env.TRIAGE_DELIVERY_BASE_DIR || defaultRestrictions().baseDir;
  return {
    baseDir: path.resolve(baseDir),
    allowExternalCallback: env.TRIAGE_ALLOW_EXTERNAL_CALLBACK === "1" || env.TRIAGE_ALLOW_EXTERNAL_CALLBACK === "true",
    allowExternalFile: env.TRIAGE_ALLOW_EXTERNAL_FILE === "1" || env.TRIAGE_ALLOW_EXTERNAL_FILE === "true",
    allowExternalSocket: env.TRIAGE_ALLOW_EXTERNAL_SOCKET === "1" || env.TRIAGE_ALLOW_EXTERNAL_SOCKET === "true",
  };
}

export function restrictFileTarget(target: string, baseDir: string): string {
  const resolved = path.resolve(baseDir, target);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("File delivery target must stay within the delivery base directory.");
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

export function restrictSocketTarget(target: string, baseDir: string): string {
  const resolved = path.resolve(baseDir, target);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Socket delivery target must stay within the delivery base directory.");
  }
  return resolved;
}

export function restrictCallbackTarget(target: string, baseDir: string, allowExternal: boolean): string {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new Error("callback channelTarget must be a valid http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("callback channelTarget must be an http(s) URL.");
  }
  if (allowExternal) return target;
  const host = url.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  const linkLocal = host.startsWith("169.254.") || host.startsWith("fe80.");
  const privateRanges = ["10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168."];
  const inPrivate = privateRanges.some((p) => host.startsWith(p));
  if (!loopback && !linkLocal && !inPrivate) {
    throw new Error("callback channelTarget must point to localhost or a private network unless TRIAGE_ALLOW_EXTERNAL_CALLBACK=1.");
  }
  return target;
}

export function deliveryBlockedDiagnostic(message: string, attempts: number): DeliveryDiagnostic {
  return {
    code: "delivery_blocked",
    message,
    attempts,
    lastError: "Target rejected by delivery restrictions.",
  };
}