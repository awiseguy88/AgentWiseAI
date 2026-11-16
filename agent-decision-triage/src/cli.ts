#!/usr/bin/env node
import fs from "fs";
import path from "path";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const base = process.env.TRIAGE_URL || "http://localhost:3457";
  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(`Usage:
  agent-decision-triage submit <payload.json>   Submit a decision item JSON payload
  agent-decision-triage inbox                  Print current inbox JSON
  agent-decision-triage export <out.json>      Export audit JSON

Env: TRIAGE_URL (default http://localhost:3457)`);
    process.exit(0);
  }
  if (cmd === "submit") {
    const file = rest[0];
    if (!file) throw new Error("submit requires a payload JSON file path");
    const payload = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    const res = await fetch(`${base}/api/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const text = await res.text();
    if (!res.ok) {
      console.error(text);
      process.exit(1);
    }
    console.log(text);
    return;
  }
  if (cmd === "inbox") {
    const res = await fetch(`${base}/api/inbox`);
    console.log(await res.text());
    return;
  }
  if (cmd === "export") {
    const out = rest[0];
    if (!out) throw new Error("export requires output path");
    const res = await fetch(`${base}/api/export.json`);
    if (!res.ok) throw new Error(await res.text());
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.resolve(out), buf);
    console.log(`Exported to ${out}`);
    return;
  }
  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});