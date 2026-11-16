#!/usr/bin/env node
import { createInterface } from "node:readline";

const tools = [
  { name: "list_services", description: "List deployed services and health", inputSchema: { type: "object", properties: {} } },
  { name: "get_service_metrics", description: "Get metrics for a service", inputSchema: { type: "object", properties: { service: { type: "string" } }, required: ["service"] } },
  { name: "restart_service", description: "Restart a service instance", inputSchema: { type: "object", properties: { service: { type: "string" } }, required: ["service"] } },
  { name: "list_alerts", description: "List active alerts", inputSchema: { type: "object", properties: {} } },
  { name: "ack_alert", description: "Acknowledge an alert", inputSchema: { type: "object", properties: { alertId: { type: "string" } }, required: ["alertId"] } },
  { name: "get_deployment", description: "Get deployment status", inputSchema: { type: "object", properties: { env: { type: "string" } }, required: ["env"] } },
];

function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "devops_fixture", version: "0.1.0" } } };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (method === "tools/call") {
    const name = params?.name;
    if (name === "list_alerts") return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify([{ id: "a1", severity: "high" }]) }] } };
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
