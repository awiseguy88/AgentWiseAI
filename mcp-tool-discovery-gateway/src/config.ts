import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GatewayConfig, PolicyConfig, ServerConfig } from "./types.js";

export function loadConfig(path: string): GatewayConfig {
  const full = resolve(path);
  const raw = JSON.parse(readFileSync(full, "utf8")) as Partial<GatewayConfig>;
  if (!raw || !Array.isArray(raw.servers)) {
    throw new Error(`Invalid config at ${full}: expected { servers: [...] }`);
  }
  const servers: ServerConfig[] = raw.servers.map((s, i) => normalizeServer(s as any, i));
  const policy: PolicyConfig = raw.policy ?? {};
  return { servers, policy };
}

function normalizeServer(s: any, i: number): ServerConfig {
  if (!s || typeof s !== "object") throw new Error(`servers[${i}] must be an object`);
  if (typeof s.name !== "string" || !s.name) throw new Error(`servers[${i}].name required`);
  if (s.transport === "stdio") {
    if (typeof s.command !== "string" || !s.command) throw new Error(`servers[${i}].command required for stdio`);
    return {
      name: s.name,
      transport: "stdio",
      command: s.command,
      args: Array.isArray(s.args) ? s.args.map(String) : [],
      cwd: typeof s.cwd === "string" ? s.cwd : undefined,
      env: s.env && typeof s.env === "object" ? s.env : undefined,
      tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
      disabled: Boolean(s.disabled),
    };
  }
  if (s.transport === "http") {
    if (typeof s.url !== "string" || !s.url) throw new Error(`servers[${i}].url required for http`);
    return {
      name: s.name,
      transport: "http",
      url: s.url,
      headers: s.headers && typeof s.headers === "object" ? s.headers : undefined,
      tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
      disabled: Boolean(s.disabled),
    };
  }
  throw new Error(`servers[${i}].transport must be "stdio" or "http"`);
}
