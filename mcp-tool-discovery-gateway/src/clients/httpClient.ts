import type { HttpServerConfig, ToolSchema } from "../types.js";

export class HttpMcpClient {
  private nextId = 1;
  constructor(private cfg: HttpServerConfig, private timeoutMs = 15000) {}

  private async request(method: string, params?: any): Promise<any> {
    const id = this.nextId++;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.cfg.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(this.cfg.headers ?? {}) },
        body,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${this.cfg.name}`);
      const msg: any = await res.json();
      if (msg.error) throw new Error(msg.error.message || JSON.stringify(msg.error));
      return msg.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-tool-discovery-gateway", version: "0.1.0" },
      });
    } catch {
      // Some simple HTTP fixtures may not require initialize; tolerate.
    }
  }

  async listTools(): Promise<ToolSchema[]> {
    const res = await this.request("tools/list", {});
    const tools = Array.isArray(res?.tools) ? res.tools : [];
    return tools as ToolSchema[];
  }

  async callTool(name: string, args: any): Promise<any> {
    return await this.request("tools/call", { name, arguments: args ?? {} });
  }

  async close(): Promise<void> {
    // stateless
  }
}
