// HTTP proxy for MCP servers.
//
// Listens on a local port, forwards POST /mcp requests to an upstream MCP
// HTTP endpoint, and applies configured faults to the upstream response.

import { createServer, IncomingMessage, ServerResponse, request as httpRequest } from "node:http";
import { parse as parseUrl } from "node:url";
import { applyFaults, DEFAULT_RULES, FaultRule } from "../faults.js";

export interface HttpProxyOptions {
  port: number;
  upstream: string; // e.g. "http://localhost:3001/mcp"
  rules?: FaultRule[];
  onMessage?: (dir: "client->server" | "server->client", msg: unknown) => void;
  onFault?: (fault: string, method: string | undefined) => void;
}

export class HttpProxy {
  private server = createServer();
  private upstreamUrl!: ReturnType<typeof parseUrl>;
  private started = false;

  constructor(private opts: HttpProxyOptions) {
    this.upstreamUrl = parseUrl(opts.upstream, true);
    this.server.on("request", this.handleRequest.bind(this));
    this.server.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EADDRINUSE") {
        console.error(`[mcp-fault-injector] HTTP proxy port ${opts.port} already in use`);
      }
    });
  }

  start(): Promise<void> {
    if (this.started) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.server.listen(this.opts.port, () => {
        this.started = true;
        resolve();
      });
      this.server.once("error", reject);
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => { this.started = false; resolve(); }));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      res.writeHead(405, { "Allow": "POST" });
      res.end("Method Not Allowed");
      return;
    }
    const path = req.url ?? "/";
    if (!path.startsWith("/mcp")) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const body = await this.readBody(req);
    let requestMsg: Record<string, unknown>;
    try {
      requestMsg = JSON.parse(body) as Record<string, unknown>;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }

    if (this.opts.onMessage) this.opts.onMessage("client->server", requestMsg);

    try {
      const upstreamRes = await this.forwardToUpstream(requestMsg);
      let responseMsg: unknown;
      try {
        responseMsg = JSON.parse(upstreamRes.body);
      } catch {
        res.writeHead(502);
        res.end("Bad Gateway: upstream returned non-JSON");
        return;
      }

      const method = requestMsg.method as string | undefined;
      const faulted = applyFaults(this.opts.rules ?? DEFAULT_RULES, method, responseMsg, Math.random);

      if (faulted.type === "drop") {
        if (this.opts.onFault) this.opts.onFault("timeout", method);
        res.destroy();
        return;
      }

      if (faulted.type === "invalidJson") {
        if (this.opts.onFault) this.opts.onFault("invalidJson", method);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("NOT_VALID_JSON{corrupted}");
        return;
      }

      if (this.opts.onFault && ((faulted.delayMs ?? 0) > 0 || faulted.payload !== responseMsg)) {
        this.opts.onFault("latency|missingFields|truncated", method);
      }

      if ((faulted.delayMs ?? 0) > 0) {
        await new Promise((r) => setTimeout(r, faulted.delayMs));
      }

      if (this.opts.onMessage) this.opts.onMessage("server->client", faulted.payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(faulted.payload));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream error", detail: String(e) }));
    }
  }

  private async readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(Buffer.from(c)));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      req.on("error", reject);
    });
  }

  private async forwardToUpstream(msg: Record<string, unknown>): Promise<{ status: number; body: string }> {
    const body = JSON.stringify(msg);
    const opts = {
      hostname: this.upstreamUrl.hostname,
      port: Number(this.upstreamUrl.port) || (this.upstreamUrl.protocol === "https:" ? 443 : 80),
      path: this.upstreamUrl.pathname + (this.upstreamUrl.search ?? ""),
      method: "POST" as const,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    return new Promise((resolve, reject) => {
      const r = httpRequest(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () => resolve({ status: res.statusCode ?? 500, body: Buffer.concat(chunks).toString("utf-8") }));
      });
      r.on("error", reject);
      r.write(body);
      r.end();
    });
  }
}