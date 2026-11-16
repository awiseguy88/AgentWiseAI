import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { StdioServerConfig, ToolSchema } from "../types.js";

interface Pending {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer?: NodeJS.Timeout;
}

export class StdioMcpClient {
  private proc: ChildProcessWithoutNullStreams;
  private pending = new Map<number | string, Pending>();
  private nextId = 1;
  private ready = false;

  constructor(private cfg: StdioServerConfig, private timeoutMs = 15000) {
    this.proc = spawn(cfg.command, cfg.args ?? [], {
      cwd: cfg.cwd,
      env: { ...process.env, ...(cfg.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const rl = createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => this.onLine(line));
    this.proc.on("error", (e) => this.rejectAll(e));
    this.proc.on("exit", (code) => {
      if (!this.ready) this.rejectAll(new Error(`stdio server ${cfg.name} exited early (${code})`));
    });
  }

  private rejectAll(err: Error) {
    for (const [id, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }

  private onLine(line: string) {
    const t = line.trim();
    if (!t) return;
    let msg: any;
    try { msg = JSON.parse(t); } catch { return; }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (p.timer) clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  }

  private request(method: string, params?: any): Promise<any> {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params: params ?? {} };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout waiting for ${method} from ${this.cfg.name}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify(payload) + "\n");
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-tool-discovery-gateway", version: "0.1.0" },
    });
    // notifications/initialized (no id)
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
    this.ready = true;
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
    try { this.proc.stdin.end(); } catch {}
    try { this.proc.kill(); } catch {}
    this.rejectAll(new Error(`stdio server ${this.cfg.name} closed`));
  }
}
