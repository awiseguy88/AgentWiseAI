#!/usr/bin/env node
import { createInterface } from "node:readline";

const tools = [
  { name: "list_failed_runs", description: "List recent failed CI runs for a repository", inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] } },
  { name: "get_run_logs", description: "Fetch logs for a CI run", inputSchema: { type: "object", properties: { runId: { type: "string" } }, required: ["runId"] } },
  { name: "list_pull_requests", description: "List open pull requests", inputSchema: { type: "object", properties: { repo: { type: "string" } } } },
  { name: "get_pull_request", description: "Get details for a pull request", inputSchema: { type: "object", properties: { repo: { type: "string" }, number: { type: "number" } }, required: ["repo","number"] } },
  { name: "list_issues", description: "List repository issues", inputSchema: { type: "object", properties: { repo: { type: "string" } } } },
  { name: "create_issue_comment", description: "Post a comment on an issue", inputSchema: { type: "object", properties: { repo: { type: "string" }, issue: { type: "number" }, body: { type: "string" } }, required: ["repo","issue","body"] } },
  { name: "get_commit_status", description: "Get status checks for a commit", inputSchema: { type: "object", properties: { repo: { type: "string" }, sha: { type: "string" } }, required: ["repo","sha"] } },
];

function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "github_ci_fixture", version: "0.1.0" } } };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (method === "tools/call") {
    const name = params?.name;
    if (name === "list_failed_runs") {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify([{ runId: "run-101", workflow: "build", branch: "main", conclusion: "failure" }, { runId: "run-99", workflow: "test", branch: "dev", conclusion: "failure" }]) }] } };
    }
    if (name === "get_run_logs") {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "error: tests failed in suite auth" }] } };
    }
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `fixture result for ${name}` }] } };
  }
  if (method === "notifications/initialized") return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    const res = handle(msg);
    if (res) process.stdout.write(JSON.stringify(res) + "\n");
  } catch {}
});
