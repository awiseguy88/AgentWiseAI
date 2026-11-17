#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import { createServer } from "./server.js";

const args = process.argv.slice(2);
const cmd = args[0];

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

async function main() {
  if (cmd === "serve") {
    const port = Number(getArg("--port") ?? "8787");
    const repoRoot = path.resolve(process.cwd(), getArg("--repo") ?? ".");
    const dbPath = getArg("--db") ?? ".local/agent-job-durability-resume.sqlite";
    const { server } = createServer({ dbPath, repoRoot });
    server.listen(port, () => {
      console.log(`[agent-job-durability-resume] listening on http://127.0.0.1:${port}`);
      console.log(`  dbPath: ${path.resolve(repoRoot, dbPath)}`);
      console.log(`  repoRoot: ${repoRoot}`);
    });
    return;
  }

  if (cmd === "demo") {
    console.log("Run `npm test` for full acceptance demo.");
    return;
  }

  console.log(`agent-job-durability-resume

Commands:
  serve --port 8787 --repo . [--db .local/agent-job-durability-resume.sqlite]
  demo  --repo . [--db .local/demo.sqlite]
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});