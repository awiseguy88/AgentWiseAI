/**
 * MCP server entrypoint (stdio transport).
 *
 * Exposes Lemonade image generation + social post preparation tools to any
 * MCP-compatible client (Claude Desktop, Cursor, etc.).
 */
import "dotenv/config";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { LemonadeClient } from "./lemonade/client.js";
// Side-effect import: registers social platform adapters.
import "./social/index.js";
import {
  TOOLS,
  makeGenerateImageHandler,
  makeLemonadeHealthHandler,
  makeListImagesHandler,
  makePrepareSocialPostHandler,
  makePublishSocialPostHandler,
} from "./tools/index.js";

const client = new LemonadeClient(config.lemonade);

const server = new Server(
  {
    name: "agentwiseai-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools.
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Dispatch tool calls.
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handlers: Record<string, (input: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>> =
    {
      lemonade_health: makeLemonadeHealthHandler(client),
      generate_image: makeGenerateImageHandler(client),
      list_images: makeListImagesHandler(),
      prepare_social_post: makePrepareSocialPostHandler(),
      publish_social_post: makePublishSocialPostHandler(),
    };

  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return handler(args ?? {});
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // eslint-disable-next-line no-console
  console.error(
    `[agentwiseai-mcp] v0.1.0 listening on stdio (lemonade: ${config.lemonade.baseUrl}, outputs: ${config.storage.outputDir})`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[agentwiseai-mcp] fatal:", err);
  process.exit(1);
});