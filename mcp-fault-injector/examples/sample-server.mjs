#!/usr/bin/env node
// Minimal offline MCP-like sample server (stdio transport).
// Responds to JSON-RPC "initialize" and "tools/list" and "tools/call" with
// fixed data so the fault-injector smoke test can verify behavior offline.

process.stdin.setEncoding("utf-8");

let buf = "";
process.stdin.on("data", (chunk: Buffer) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const id = msg.id;
    const method = msg.method as string | undefined;

    let result: unknown;
    if (method === "initialize") {
      result = {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "mcp-fault-injector-sample", version: "0.1.0" },
        capabilities: { tools: {} },
      };
    } else if (method === "tools/list") {
      result = {
        tools: [
          { name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
        ],
      };
    } else if (method === "tools/call") {
      const params = (msg.params ?? {}) as Record<string, unknown>;
      const tool = (params.name as string) ?? "";
      const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
      if (tool === "echo") {
        result = { content: [{ type: "text", text: String(args.text ?? "") }] };
      } else {
        result = { content: [{ type: "text", text: `unknown tool ${tool}` }] };
      }
    } else {
      result = { content: [{ type: "text", text: `method ${method ?? "(none)"} not handled by sample server` }] };
    }

    const out = JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n";
    process.stdout.write(out);
  }
});