#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import http from "http";
import net from "net";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SCENARIO_FILE = path.join(REPO_ROOT, "fixtures", "scenarios", "mixed-batch.json");
const PORT = Number(process.env.DEMO_PORT || 3459);
const BASE_URL = `http://127.0.0.1:${PORT}`;

interface ScenarioItem {
  id: string;
  type: string;
  context: any;
  channel: "callback" | "file" | "socket";
  channelTarget?: string;
}

async function main() {
  const dbPath = path.join(REPO_ROOT, ".local", "triage.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const { createApp } = await import("../../src/server.js");
  const { app } = createApp(dbPath);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`Triage server: ${BASE_URL}`);

  const scenario = JSON.parse(fs.readFileSync(SCENARIO_FILE, "utf8")) as { items: ScenarioItem[] };

  const fileTargets = new Map<string, string>();
  const socketTargets = new Map<string, string>();
  const socketResponses = new Map<string, Promise<any>>();
  const socketServers: net.Server[] = [];
  let callbackServer: http.Server | null = null;
  let callbackUrl = "";
  let callbackWait: Promise<any> = Promise.resolve(null);

  // Prepare targets and servers
  for (const item of scenario.items) {
    if (item.channel === "file") {
      const t = path.join(REPO_ROOT, ".local", `demo-${item.id}.json`);
      fileTargets.set(item.id, t);
      item.channelTarget = t;
    } else if (item.channel === "socket") {
      const t = path.join(REPO_ROOT, ".local", `demo-${item.id}.sock`);
      socketTargets.set(item.id, t);
      item.channelTarget = t;
      fs.mkdirSync(path.dirname(t), { recursive: true });
      try { if (fs.existsSync(t)) fs.unlinkSync(t); } catch {}
      let resolveSock: (v: any) => void = () => {};
      socketResponses.set(item.id, new Promise((resolve) => (resolveSock = resolve)));
      const srv = net.createServer((socket) => {
        let d = "";
        socket.on("data", (c) => (d += c.toString()));
        socket.on("end", () => {
          try { resolveSock(JSON.parse(d.trim())); } catch { resolveSock(d.trim()); }
        });
      });
      socketServers.push(srv);
      await new Promise<void>((resolve) => srv.listen(t, resolve));
    } else if (item.channel === "callback") {
      if (!callbackServer) {
        let resolveCb: (v: any) => void = () => {};
        callbackWait = new Promise((resolve) => (resolveCb = resolve));
        callbackServer = http.createServer((req, res) => {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            try { resolveCb(JSON.parse(body)); } catch { resolveCb(body); }
            res.writeHead(200); res.end("ok");
          });
        });
        await new Promise<void>((resolve) => callbackServer!.listen(0, "127.0.0.1", resolve));
        const addr = callbackServer.address() as net.AddressInfo;
        callbackUrl = `http://127.0.0.1:${addr.port}/cb`;
      }
      item.channelTarget = callbackUrl;
    }
  }

  console.log("\n=== Submitting 3 sessions / 5 decision items ===");
  for (const item of scenario.items) {
    const payload = {
      type: item.type,
      context: item.context,
      channel: item.channel,
      channelTarget: item.channelTarget,
    };
    const res = await fetch(`${BASE_URL}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`  ${item.id} -> item ${data.item?.id} ${data.deduped ? "(deduped/linked)" : ""}`);
  }

  const queue = await (await fetch(`${BASE_URL}/api/inbox`)).json();
  const active = queue.items.filter((i: any) => ["pending", "snoozed", "needs-info"].includes(i.status));
  console.log("\n=== Numbered inbox ===");
  for (const it of active) {
    const dups = it.duplicates?.length ? ` linked duplicates: [${it.duplicates.map((d: any) => `#${d.id} ${d.session}`).join(", ")}]` : "";
    console.log(`  #${it.queueNumber} (id ${it.id}) ${it.type} session=${it.session} :: ${it.summary}${dups}`);
  }

  console.log("\n=== Operator resolves numbered batch in one pass ===");
  const resolutions = active.map((it: any) => {
    let response: any;
    if (it.type === "question") response = { answer: "Use Redis for production; in-memory for dev." };
    else if (it.type === "approval") response = { approved: true, note: "Migration looks safe on dev." };
    else if (it.type === "review") response = { approved: true, comments: "LGTM; add unit test for empty strings." };
    else response = { accepted: true, note: "Verified; close task." };
    return { id: it.id, response, responder: "demo-operator" };
  });
  console.log("Resolving items:", resolutions.map((r) => r.id).join(", "));
  const batchRes = await fetch(`${BASE_URL}/api/batch/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolutions }),
  });
  console.log("Batch result:", JSON.stringify(await batchRes.json(), null, 2));

  // Wait for deliveries
  await new Promise((r) => setTimeout(r, 300));
  console.log("\n=== Waiting fixture agents received responses ===");
  for (const [id, target] of fileTargets) {
    if (fs.existsSync(target)) {
      console.log(`  ${id} (file):`, fs.readFileSync(target, "utf8").trim().slice(0, 160));
    }
  }
  for (const [id, p] of socketResponses) {
    const v = await Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))]).catch((e) => ({ error: e.message }));
    console.log(`  ${id} (socket):`, JSON.stringify(v).slice(0, 160));
  }
  const cb = await Promise.race([callbackWait, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))]).catch((e) => ({ error: e.message }));
  console.log(`  approval (callback):`, JSON.stringify(cb).slice(0, 160));
  console.log("\n=== Export audit reports ===");
  const reportsDir = path.join(REPO_ROOT, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = Date.now();
  const j = await (await fetch(`${BASE_URL}/api/export.json`)).json();
  const jpath = path.join(reportsDir, `audit-${stamp}.json`);
  fs.writeFileSync(jpath, JSON.stringify(j, null, 2));
  const h = await (await fetch(`${BASE_URL}/api/export.html`)).text();
  const hpath = path.join(reportsDir, `audit-${stamp}.html`);
  fs.writeFileSync(hpath, h);
  console.log(`  JSON: ${jpath}`);
  console.log(`  HTML: ${hpath}`);

  server.close();
  if (callbackServer) await new Promise<void>((r) => callbackServer!.close(() => r()));
  for (const s of socketServers) s.close();
  console.log("\nDemo complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});