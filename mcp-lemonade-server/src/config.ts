/**
 * Runtime configuration for the AgentWiseAI MCP server.
 *
 * All values come from environment variables (`.env` when present) with safe
 * defaults for local-first operation.
 */

export const config = {
  lemonade: {
    /** Base URL of the local Lemonade server, e.g. http://127.0.0.1:8000 */
    baseUrl: process.env.LEMONADE_BASE_URL || "http://127.0.0.1:8000",
    /** Optional API key/token for Lemonade, if the server enforces auth. */
    apiKey: process.env.LEMONADE_API_KEY,
    /** Request timeout in milliseconds. */
    timeoutMs: Number(process.env.LEMONADE_TIMEOUT_MS) || 60_000,
  },
  storage: {
    /** Directory where generated images + metadata sidecars are written. */
    outputDir: process.env.OUTPUT_DIR || resolveOutputDir(),
  },
  social: {
    /** Comma-separated list of platform ids that are allowed to publish. */
    enabledPlatforms: (process.env.SOCIAL_ENABLED_PLATFORMS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /** When true, publish calls only return a preview/dry-run and never post. */
    dryRunByDefault: process.env.SOCIAL_DRY_RUN_DEFAULT !== "false",
  },
  /** If true, the server binds only to stdio (recommended for local MCP). */
  transport: (process.env.MCP_TRANSPORT || "stdio") as "stdio" | "http",
};

function resolveOutputDir(): string {
  // Keep generated assets inside the repo's `outputs/` folder by default.
  return join(process.cwd(), "outputs");
}

function join(a: string, b: string): string {
  return a.endsWith("/") || a.endsWith("\\") ? a + b : `${a}/${b}`;
}