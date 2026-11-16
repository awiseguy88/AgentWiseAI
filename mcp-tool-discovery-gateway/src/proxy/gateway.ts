import type { GatewayConfig, IndexedTool, AuditEvent, SearchResult, AuditReport } from "../types.js";
import { ToolIndex } from "../index/toolIndex.js";
import { schemaHash, byteSize, estimateTokensFromBytes } from "../utils/hash.js";
import { createAuditReport, record, finalizeReport, seedIndexTotals } from "../audit/report.js";

export interface InvokeResult {
  ok: boolean;
  result?: any;
  error?: string;
}

export interface SchemaResult {
  tool: IndexedTool;
  schemaBytes: number;
  schemaTokensEstimate: number;
}

export interface PolicyError extends Error {
  code: "POLICY_DENY" | "SERVER_ERROR" | "INDEX_ERROR";
  toolId?: string;
}

function policyErr(msg: string, code: PolicyError["code"], toolId?: string): PolicyError {
  const e = new Error(msg) as PolicyError;
  e.code = code;
  e.toolId = toolId;
  return e;
}

function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === value) return true;
  if (pattern.includes("*")) {
    const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
    return re.test(value);
  }
  return false;
}

export class Gateway {
  private index: ToolIndex;
  private cfg: GatewayConfig;
  private report!: AuditReport;

  constructor(cfg: GatewayConfig) {
    this.cfg = cfg;
    this.index = new ToolIndex(cfg);
  }

  async init(): Promise<void> {
    await this.index.refresh();
    this.report = createAuditReport(new Date().toISOString());
    seedIndexTotals(this.report, this.index.all);
  }

  get indexedTools(): IndexedTool[] {
    return this.index.all;
  }

  get indexState() {
    return this.index.state;
  }

  private allowedServer(server: string): boolean {
    const { policy } = this.cfg;
    if (!policy) return true;
    if (policy.denyServers?.includes(server)) return false;
    if (policy.allowServers && policy.allowServers.length > 0) return policy.allowServers.includes(server);
    return true;
  }

  private allowedTool(server: string, toolName: string): { ok: boolean; reason?: string } {
    const full = `${server}.${toolName}`;
    const { policy } = this.cfg;
    if (!policy) return { ok: true };
    if (policy.denyServers?.includes(server)) return { ok: false, reason: `server ${server} denied by policy` };
    if (policy.allowServers && policy.allowServers.length > 0 && !policy.allowServers.includes(server)) {
      return { ok: false, reason: `server ${server} not in allow list` };
    }
    if (policy.denyTools && policy.denyTools.some((p) => matchesPattern(p, full) || matchesPattern(p, toolName))) {
      return { ok: false, reason: `tool ${full} denied by policy` };
    }
    if (policy.allowTools && policy.allowTools.length > 0) {
      const ok = policy.allowTools.some((p) => matchesPattern(p, full) || matchesPattern(p, toolName));
      if (!ok) return { ok: false, reason: `tool ${full} not in allow list` };
    }
    return { ok: true };
  }

  search(query: string, opts?: { server?: string; tags?: string[]; limit?: number }): { results: SearchResult[]; audit: AuditEvent } {
    const results = this.index.search(query, opts);
    const event: AuditEvent = {
      ts: new Date().toISOString(),
      type: "search",
      query,
      ok: true,
      detail: `${results.length} result(s)`,
    };
    record(this.report, event);
    return { results, audit: event };
  }

  reportSnapshot(): AuditReport {
    return this.report;
  }

  async schema(server: string, toolName: string): Promise<SchemaResult> {
    const toolId = `${server}.${toolName}`;
    const check = this.allowedTool(server, toolName);
    if (!check.ok) {
      const e = policyErr(check.reason ?? "denied", "POLICY_DENY", toolId);
      record(this.report, { ts: new Date().toISOString(), type: "policy_deny", toolId, server, ok: false, detail: check.reason });
      throw e;
    }
    const indexed = this.index.get(toolId);
    if (!indexed) {
      const e = policyErr(`tool ${toolId} not found in index`, "INDEX_ERROR", toolId);
      record(this.report, { ts: new Date().toISOString(), type: "error", toolId, server, ok: false, detail: e.message });
      throw e;
    }
    const { policy } = this.cfg;
    const maxCount = policy?.maxSchemasPerRequest;
    const maxBytes = policy?.maxSchemaBytesPerRequest;
    if (maxCount && maxCount < 1) {
      const e = policyErr(`schema request budget (count=${maxCount}) exhausted`, "POLICY_DENY", toolId);
      record(this.report, { ts: new Date().toISOString(), type: "policy_deny", toolId, server, ok: false, detail: e.message });
      throw e;
    }
    if (maxBytes && indexed.schemaBytes > maxBytes) {
      const e = policyErr(`schema request budget (bytes=${indexed.schemaBytes} > ${maxBytes}) exhausted`, "POLICY_DENY", toolId);
      record(this.report, { ts: new Date().toISOString(), type: "policy_deny", toolId, server, ok: false, detail: e.message });
      throw e;
    }

    const bytes = indexed.schemaBytes;
    const est = estimateTokensFromBytes(bytes);
    record(this.report, {
      ts: new Date().toISOString(),
      type: "schema",
      toolId,
      server,
      ok: true,
      detail: `schema loaded on demand (${bytes} bytes)`,
      schemaBytes: bytes,
      estimatedTokens: est,
    });
    return { tool: indexed, schemaBytes: bytes, schemaTokensEstimate: est };
  }

  async invoke(server: string, toolName: string, args: any): Promise<InvokeResult> {
    const toolId = `${server}.${toolName}`;
    const check = this.allowedTool(server, toolName);
    if (!check.ok) {
      const e = policyErr(check.reason ?? "denied", "POLICY_DENY", toolId);
      record(this.report, { ts: new Date().toISOString(), type: "policy_deny", toolId, server, ok: false, detail: check.reason });
      return { ok: false, error: e.message };
    }
    const indexed = this.index.get(toolId);
    if (!indexed) {
      return { ok: false, error: `tool ${toolId} not found in index` };
    }

    const { StdioMcpClient } = await import("../clients/stdioClient.js");
    const { HttpMcpClient } = await import("../clients/httpClient.js");
    const serverCfg = this.cfg.servers.find((s) => s.name === server);
    if (!serverCfg || serverCfg.disabled) {
      return { ok: false, error: `server ${server} not configured or disabled` };
    }
    const client = serverCfg.transport === "stdio" ? new StdioMcpClient(serverCfg) : new HttpMcpClient(serverCfg);
    try {
      await client.initialize();
      const result = await client.callTool(toolName, args ?? {});
      record(this.report, { ts: new Date().toISOString(), type: "invoke", toolId, server, ok: true, detail: `invoked ${toolId}` });
      return { ok: true, result };
    } catch (e) {
      const err = e as Error;
      record(this.report, { ts: new Date().toISOString(), type: "error", toolId, server, ok: false, detail: err.message });
      return { ok: false, error: err.message };
    } finally {
      await client.close().catch(() => {});
    }
  }

  finalize(): AuditReport {
    return finalizeReport(this.report);
  }

  get auditReport(): AuditReport {
    return this.report;
  }
}
