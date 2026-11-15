// stdio proxy for MCP servers.
//
// Spawns the target command, forwards client->server messages untouched, and
// applies configured faults to server->client JSON-RPC messages. Line-delimited
// JSON-RPC framing (MCP stdio transport).

import { spawn } from "node:child_process";
import * as readline from "node:readline";
import { applyFaults, DEFAULT_RULES, FaultRule } from "../faults.js";

export interface StdioProxyOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  rules?: FaultRule[];
  onMessage?: (dir: "client->server" | "server->client", msg: unknown) => void;
  onFault?: (fault: string, method: string | undefined) => void;
}

export class StdioProxy {
  private proc: import("node:child_process").ChildProcess;
  private out: readline.ReadLine;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; method?: string }>();
  private seq = 0;
  private closed = false;
  private onCloseResolve?: () => void;

  constructor(private opts: StdioProxyOptions) {
    this.proc = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["pipe", "pipe", "inherit"],
    });

    this.out = readline.createInterface({ input: this.proc.stdout!, crlfDelay: Infinity });

    this.proc.stdin!.setDefaultEncoding("utf-8");

    this.proc.on("exit", () => {
      this.closed = true;
      this.out.close();
      for (const [, p] of this.pending) p.reject(new Error("stdio proxy child exited"));
      this.pending.clear();
      this.onCloseResolve?.();
    });

    this.proc.on("error", (e) => {
      this.closed = true;
      for (const [, p] of this.pending) p.reject(e);
      this.pending.clear();
      this.onCloseResolve?.();
    });

    this.out.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Non-JSON server output: forward untouched.
        this.forwardRaw(trimmed);
        return;
      }
      this.handleServerMessage(parsed);
    });
  }

  /** Send a client->server message (untouched) and await its response. */
  async request(message: Record<string, unknown>): Promise<unknown> {
    const line = JSON.stringify(message);
    this.proc.stdin!.write(line + "\n");
    if (this.opts.onMessage) this.opts.onMessage("client->server", message);

    // If message has an id, wait for the matching server response.
    const id = message.id;
    if (typeof id !== "number") {
      return { acknowledged: true };
    }

    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method: typeof message.method === "string" ? message.method : undefined });
    });
  }

  close(): void {
    try { this.proc.stdin?.end(); } catch {}
    try { this.proc.kill(); } catch {}
  }

  waitForClose(): Promise<void> {
    if (this.closed) return Promise.resolve();
    return new Promise((resolve) => { this.onCloseResolve = resolve; });
  }

  private handleServerMessage(parsed: unknown): void {
    const msg = parsed as Record<string, unknown>;
    const id = msg.id;
    const method = msg.method as string | undefined;

    // Responses carry id + result/error; requests/notifications carry method.
    if (id !== undefined && typeof id === "number") {
      const waiter = this.pending.get(id as number);
      if (waiter) {
        this.pending.delete(id as number);
        const faulted = applyFaults(this.opts.rules ?? DEFAULT_RULES, waiter.method, msg, Math.random);
        if (faulted.type === "drop") {
          if (this.opts.onFault) this.opts.onFault("timeout", waiter.method);
          waiter.reject(new Error(`MCP fault: timeout (response dropped for id ${id})`));
          return;
        }
        if (faulted.type === "invalidJson") {
          if (this.opts.onFault) this.opts.onFault("invalidJson", waiter.method);
          waiter.reject(new Error("MCP fault: invalid JSON response"));
          return;
        }
        const delayMs = faulted.delayMs ?? 0;
        if (this.opts.onFault && (delayMs > 0 || faulted.payload !== msg)) this.opts.onFault("latency|missingFields|truncated", waiter.method);
        if (delayMs > 0) {
          setTimeout(() => waiter.resolve(faulted.payload), delayMs).unref?.();
        } else {
          waiter.resolve(faulted.payload);
        }
        if (this.opts.onMessage) this.opts.onMessage("server->client", faulted.payload);
        return;
      }
    }
    // Unsolicited server message (notification): forward untouched.
    if (this.opts.onMessage) this.opts.onMessage("server->client", msg);
  }

  private forwardRaw(text: string): void {
    process.stdout.write(text + "\n");
  }
}
