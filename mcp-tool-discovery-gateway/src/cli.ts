#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { Gateway } from "./proxy/gateway.js";
import { ToolIndex } from "./index/toolIndex.js";
import { finalizeReport, writeReport, record } from "./audit/report.js";
import type { GatewayConfig } from "./types.js";

function printHelp() {
  console.log(`mcp-tool-discovery-gateway — searchable MCP tool discovery + proxy invocation

Usage:
  mcp-tool-discovery-gateway <command> [options]

Commands:
  index --config <file>                     Show indexed tools across configured servers.
  search --config <file> --query <text>     Search the local tool index.
  schema --config <file> --tool server.tool Print a tool's full schema (fetched on demand).
  invoke --config <file> --tool server.tool --args <json> Invoke a tool via proxy.
  serve --config <file> [--port <n>]        Start a local proxy API server (experimental).
  demo --config <file> --out <dir>          Run smoke demo: discover + invoke 2 tools, write accounting + audit report.

Options:
  --help      Show this help
  --config    Path to gateway config JSON
  --query     Search query text
  --tool      Tool id "server.tool"
  --args      JSON object string for tool call arguments
  --out       Output directory for demo/report artifacts
  --port      Port for serve mode (default 8787)
`);
}

function parseArgs(argv: string[]): Record<string, string | boolean> & { _cmd?: string } {
  const out: Record<string, string | boolean> & { _cmd?: string } = {};
  const positional: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        out[key] = argv[++i];
      } else {
        out[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  if (positional.length > 0) out._cmd = positional[0];
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args._cmd) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const cmd = String(args._cmd);
  let config: GatewayConfig;
  try { config = loadConfig(String(args.config ?? "fixtures/config.demo.json")); }
  catch (e) {
    console.error(`mcp-tool-discovery-gateway: failed to load config ${args.config}: ${(e as Error).message}`);
    process.exitCode = 2;
    return;
  }

  const gateway = new Gateway(config);
  await gateway.init();

  try {
    switch (cmd) {
      case "index": {
        const tools = gateway.indexedTools;
        console.log(`Indexed tools: ${tools.length} across ${config.servers.filter((s) => !s.disabled).length} server(s)`);
        for (const t of tools) {
          console.log(`  ${t.id} | ${t.description || "(no description)"} | ${t.schemaBytes} bytes | tags: ${t.tags.join(",") || "-"}`);
        }
        break;
      }
      case "search": {
        const query = String(args.query ?? "");
        const server = args.server ? String(args.server) : undefined;
        const tags = args.tags ? String(args.tags).split(",") : undefined;
        const { results } = gateway.search(query, { server, tags, limit: 50 });
        console.log(`Search "${query}": ${results.length} result(s)`);
        for (const r of results) {
          console.log(`  ${r.id} | ${r.description || "(no description)"} | hash ${r.schemaHash} | tags: ${r.tags.join(",") || "-"}`);
        }
        break;
      }
      case "schema": {
        const toolId = String(args.tool ?? "");
        const [server, toolName] = toolId.split(".");
        const result = await gateway.schema(server, toolName);
        console.log(JSON.stringify(result.tool.schema, null, 2));
        console.log(`# schema bytes: ${result.schemaBytes} (est. tokens ~${result.schemaTokensEstimate})`);
        break;
      }
      case "invoke": {
        const toolId = String(args.tool ?? "");
        const [server, toolName] = toolId.split(".");
        const argsJson = String(args.args ?? "{}");
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(argsJson); } catch { console.error("invalid --args JSON"); process.exitCode = 2; return; }
        const res = await gateway.invoke(server, toolName, parsedArgs);
        if (res.ok) {
          console.log(JSON.stringify(res.result, null, 2));
        } else {
          console.error(`invoke failed: ${res.error}`);
          process.exitCode = 1;
        }
        break;
      }
      case "demo": {
        await runDemo(gateway, config, args);
        break;
      }
      case "serve": {
        const port = Number(args.port ?? 8787);
        await runServe(gateway, port);
        break;
      }
      default:
        console.error(`unknown command: ${cmd}`);
        printHelp();
        process.exitCode = 2;
    }
  } finally {
    finalizeReport(gateway.finalize());
  }
}

const HEADER = `
MCP Tool Discovery Gateway — Demo (discovery on demand, no upfront full-schema load)
====================================================================================
`;

async function runDemo(gateway: Gateway, _config: GatewayConfig, args: Record<string, string | boolean>) {
  const outDir = String(args.out ?? "examples/demo-output");

  console.log(HEADER);
  const task = "find recent failed CI runs and post summary";
  console.log(`Task: ${task}`);
  console.log(`Indexed: ${gateway.indexState.tools.length} tools / ${gateway.indexState.totalSchemaBytes} bytes / ~${gateway.indexState.totalSchemaTokensEstimate} est. tokens (available in index, NOT preloaded to client)`);

  // Step 1: search for CI-related tools.
  const { results: ciResults } = gateway.search("failed ci", { limit: 10 });
  console.log(`\n[search "failed ci"] -> ${ciResults.length} result(s) (index-only, no full schemas returned)`);
  for (const r of ciResults.slice(0, 5)) console.log(`   * ${r.id} — ${r.description || "(no description)"} (hash ${r.schemaHash})`);

  // Step 2: pick CI tool, fetch schema on demand and invoke.
  const ciTool = ciResults.find((r) => r.name.includes("failed") || r.name.includes("ci"));
  if (!ciTool) throw new Error("demo: no CI tool found in index");
  const [ciServer, ciToolName] = ciTool.id.split(".");
  console.log(`\n[schema ${ciTool.id}] fetching full schema on demand...`);
  const ciSchema = await gateway.schema(ciServer, ciToolName);
  console.log(`   loaded schema: ${ciSchema.schemaBytes} bytes (~${ciSchema.schemaTokensEstimate} est. tokens)`);
  const ciInvoke = await gateway.invoke(ciServer, ciToolName, { repo: "acme/app" });
  if (!ciInvoke.ok) throw new Error(`demo invoke failed: ${ciInvoke.error}`);
  console.log(`   invoke result: ${JSON.stringify(ciInvoke.result)}`);

  // Step 3: search for chat tool, fetch schema on demand and invoke.
  const { results: chatResults } = gateway.search("post summary chat", { limit: 10 });
  console.log(`\n[search "post summary chat"] -> ${chatResults.length} result(s)`);
  for (const r of chatResults.slice(0, 5)) console.log(`   * ${r.id} — ${r.description || "(no description)"}`);
  const chatTool = chatResults.find((r) => r.name === "post_summary");
  if (!chatTool) throw new Error("demo: no chat post_summary tool found");
  const [chatServer, chatToolName] = chatTool.id.split(".");
  console.log(`\n[schema ${chatTool.id}] fetching full schema on demand...`);
  const chatSchema = await gateway.schema(chatServer, chatToolName);
  console.log(`   loaded schema: ${chatSchema.schemaBytes} bytes (~${chatSchema.schemaTokensEstimate} est. tokens)`);
  const summary = { failedRuns: [{ runId: "run-101", workflow: "build" }, { runId: "run-99", workflow: "test" }] };
  const chatInvoke = await gateway.invoke(chatServer, chatToolName, { channel: "#ci-alerts", text: `CI summary: ${JSON.stringify(summary)}` });
  if (!chatInvoke.ok) throw new Error(`demo invoke failed: ${chatInvoke.error}`);
  console.log(`   invoke result: ${JSON.stringify(chatInvoke.result)}`);

  // Step 4: accounting and report.
  const finished = finalizeReport(gateway.auditReport);
  writeReport(outDir, finished);

  console.log(`\n--- Accounting (captured) ---`);
  console.log(`Before (all indexed schemas, if preloaded): ${finished.totals.indexedSchemaBytes} bytes / ~${finished.totals.indexedSchemaTokensEstimate} est. tokens across ${finished.totals.indexedTools} tools`);
  console.log(`After  (schemas actually requested/loaded): ${finished.totals.requestedSchemaBytes} bytes / ~${finished.totals.requestedSchemaTokensEstimate} est. tokens across ${finished.totals.requestedSchemaCount} tool(s)`);
  console.log(`Estimated tokens avoided:                    ${finished.totals.indexedSchemaTokensEstimate - finished.totals.requestedSchemaTokensEstimate}`);
  console.log(`\nReport written to ${outDir}/audit.json and ${outDir}/audit.html`);
}

async function runServe(gateway: Gateway, port: number) {
  console.log(`mcp-tool-discovery-gateway serve not implemented in first workflow (port ${port}).`);
  console.log("Use index/search/schema/invoke CLI commands instead.");
  process.exitCode = 0;
}

main().catch((err) => {
  console.error(`mcp-tool-discovery-gateway: ${(err as Error).message}`);
  process.exitCode = 1;
});
