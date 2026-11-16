#!/usr/bin/env node
import { createInterface } from "node:readline";

const tools = [
  { name: "post_summary", description: "Post a summary message to a chat channel", inputSchema: { type: "object", properties: { channel: { type: "string" }, text: { type: "string" } }, required: ["channel","text"] } },
  { name: "list_channels", description: "List available chat channels", inputSchema: { type: "object", properties: {} } },
  { name: "send_direct_message", description: "Send a direct message to a user", inputSchema: { type: "object", properties: { user: { type: "string" }, text: { type: "string" } }, required: ["user","text"] } },
  { name: "search_messages", description: "Search chat messages by keyword", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_thread", description: "Fetch messages in a thread", inputSchema: { type: "object", properties: { threadId: { type: "string" } }, required: ["threadId"] } },
  { name: "add_reaction", description: "Add emoji reaction to a message", inputSchema: { type: "object", properties: { messageId: { type: "string" }, emoji: { type: "string" } }, required: ["messageId","emoji"] } },
  { name: "set_channel_topic", description: "Update a channel topic", inputSchema: { type: "object", properties: { channel: { type: "string" }, topic: { type: "string" } }, required: ["channel","topic"] } },
];

function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "chat_fixture", version: "0.1.0" } } };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (method === "tools/call") {
    const name = params?.name;
    const a = params?.arguments || {};
    if (name === "post_summary") {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ ok: true, channel: a.channel, posted: a.text }) }] } };
    }
    if (name === "list_channels") {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(["#ci-alerts", "#eng", "#general"]) }] } };
    }
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `fixture result for ${name}` }] } };
  }
  if (method === "notifications/initialized") return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try { const msg = JSON.parse(line); const res = handle(msg); if (res) process.stdout.write(JSON.stringify(res) + "\n"); } catch {}
});
