import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import net from "net";
import { createApp } from "../src/server";

async function startServer(dbPath: string) {
  const { app, db } = createApp(dbPath);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  return { server, db, base, close: () => new Promise<void>((r) => server.close(() => r())) };
}

async function post(base: string, p: string, body: any) {
  const res = await fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  return { status: res.status, data };
}
async function get(base: string, p: string) {
  const res = await fetch(base + p);
  const data = await res.json();
  return { status: res.status, data };
}

test("mixed batch acceptance: dedupe, numbered queue, batch resolve, audit, exports", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-int-"));
  const dbPath = path.join(dir, "t.db");
  const s = await startServer(dbPath);
  const isWin = process.platform === "win32";
  try {
    const f1 = path.join(dir, "q1.json");
    const f2 = path.join(dir, "q2.json");
    const f3 = path.join(dir, "done.json");
    const f4 = path.join(dir, "review.json");
    const sockPath = path.join(dir, "review.sock");

    // socket listener for review item (skip on Windows; unix sockets not supported)
    let sockReceived: any = null;
    let sockServer: net.Server | null = null;
    if (!isWin) {
      sockServer = net.createServer((socket) => {
        let d = ""; socket.on("data", c => d += c.toString()); socket.on("end", () => { try { sockReceived = JSON.parse(d.trim()); } catch { sockReceived = d; } });
      });
      await new Promise<void>((r) => sockServer!.listen(sockPath, r));
    }

    // callback server for approval
    let cbReceived: any = null;
    const cbServer = http.createServer((req, res) => { let d=""; req.on("data",c=>d+=c); req.on("end",()=>{ cbReceived=JSON.parse(d); res.writeHead(200); res.end("ok"); }); });
    await new Promise<void>((r) => cbServer.listen(0, "127.0.0.1", r));
    const cbPort = (cbServer.address() as net.AddressInfo).port;

    const items = [
      { type: "question", context: { summary: "Should I use Redis or in-memory cache for the session store?", session: "session-claude-1", agent: "claude-code" }, channel: "file", channelTarget: f1 },
      { type: "question", context: { summary: "Should I use Redis or in-memory cache for the session store?", session: "session-codex-2", agent: "codex" }, channel: "file", channelTarget: f2 },
      { type: "approval", context: { summary: "Approve migration 004?", session: "session-claude-1", agent: "claude-code" }, channel: "callback", channelTarget: `http://127.0.0.1:${cbPort}/cb` },
      { type: "review", context: { summary: "Review diff: login validation", session: "session-cursor-3", agent: "cursor", diff: { path: "src/auth/login.ts", after: "if (!email) throw err;" } }, channel: isWin ? "file" : "socket", channelTarget: isWin ? f4 : sockPath },
      { type: "done-claim", context: { summary: "Implementation complete: tests pass", session: "session-codex-2", agent: "codex" }, channel: "file", channelTarget: f3 },
    ];

    const submitted: any[] = [];
    for (const item of items) {
      const r = await post(s.base, "/api/items", item);
      assert.equal(r.status, 201, `submit failed: ${JSON.stringify(r.data)}`);
      submitted.push(r.data);
    }
    // dedupe: second question linked
    assert.equal(submitted[1].deduped, true);
    assert.equal(submitted[1].item.linkedTo, submitted[0].item.id);

    const inbox = await get(s.base, "/api/inbox");
    const active = inbox.data.items.filter((i: any) => ["pending","snoozed","needs-info"].includes(i.status));
    assert.equal(active.length, 4, "numbered queue should show 4 primary actionable items (5th linked)");
    const nums = active.map((i: any) => i.queueNumber);
    assert.deepEqual(nums, [1,2,3,4]);
    // primary question has attached duplicate
    const qPrimary = active.find((i: any) => i.id === submitted[0].item.id);
    assert.ok(qPrimary);
    assert.equal(qPrimary.duplicates.length, 1);
    assert.ok(qPrimary.context.summary.includes("Redis"));

    // resolve batch in one pass
    const resolutions = active.map((i: any) => {
      const resp = i.type === "question" ? { answer: "Use Redis" }
        : i.type === "approval" ? { approved: true }
        : i.type === "review" ? { approved: true, comment: "ok" }
        : { accepted: true };
      return { id: i.id, response: resp, responder: "alice" };
    });
    const batch = await post(s.base, "/api/batch/resolve", { resolutions });
    assert.equal(batch.status, 200);

    await new Promise(r => setTimeout(r, 100)); // allow socket/file flush
    // each waiting fixture agent receives correct structured response
    const r1 = JSON.parse(fs.readFileSync(f1, "utf8"));
    const r2 = JSON.parse(fs.readFileSync(f2, "utf8"));
    const r3 = JSON.parse(fs.readFileSync(f3, "utf8"));
    assert.equal(r1.response.answer, "Use Redis");
    assert.equal(r2.response.answer, "Use Redis"); // duplicate caller also receives
    assert.equal(r3.response.accepted, true);
    assert.equal(cbReceived.response.approved, true);
    if (!isWin) {
      assert.equal(sockReceived.response.comment, "ok");
    } else {
      // On Windows, review uses file channel instead of socket
      const r4 = JSON.parse(fs.readFileSync(f4, "utf8"));
      assert.equal(r4.response.comment, "ok");
    }

    // each resolution recorded with timestamp and responder
    const allItems = (await get(s.base, "/api/audit")).data.items;
    const resolved = allItems.filter((i: any) => i.status === "resolved");
    assert.equal(resolved.length, 5, "all 5 including duplicate resolved");
    for (const it of resolved) {
      assert.equal(it.resolvedBy, "alice");
      assert.ok(it.resolvedAt);
    }

    // export JSON/HTML
    const ej = await fetch(s.base + "/api/export.json");
    assert.equal(ej.status, 200);
    const j = await ej.json();
    assert.ok(j.audit.length > 0);
    const eh = await fetch(s.base + "/api/export.html");
    assert.equal(eh.status, 200);
    const h = await eh.text();
    assert.ok(h.includes("Audit Report"));
    assert.ok(h.includes("alice"));

    await new Promise<void>(r => cbServer.close(() => r()));
    if (sockServer) await new Promise<void>(r => sockServer.close(() => r()));
  } finally {
    await s.close();
  }
});

test("malformed payload rejected and unreachable callback does not block others; audit intact", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-fail-"));
  const dbPath = path.join(dir, "t.db");
  const s = await startServer(dbPath);
  try {
    // malformed
    const bad = await post(s.base, "/api/items", { type: "nope", context: {} });
    assert.equal(bad.status, 400);
    assert.ok(bad.data.diagnostics.length > 0);
    assert.match(bad.data.message, /type/);

    const okFile = path.join(dir, "ok.json");
    const a = await post(s.base, "/api/items", { type: "question", context: { summary: "Q ok", session: "s1" }, channel: "file", channelTarget: okFile });
    const b = await post(s.base, "/api/items", { type: "approval", context: { summary: "Bad cb", session: "s2" }, channel: "callback", channelTarget: "http://127.0.0.1:9/nope" });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const batch = await post(s.base, "/api/batch/resolve", { resolutions: [
      { id: a.data.item.id, response: "yes", responder: "op" },
      { id: b.data.item.id, response: { approved: true }, responder: "op" },
    ]});
    assert.equal(batch.status, 200);

    // first delivered fine
    assert.equal(JSON.parse(fs.readFileSync(okFile, "utf8")).response, "yes");
    const itemA = (await get(s.base, `/api/items/${a.data.item.id}`)).data.item;
    const itemB = (await get(s.base, `/api/items/${b.data.item.id}`)).data.item;
    assert.equal(itemA.status, "resolved");
    assert.equal(itemB.status, "failed");
    assert.ok(itemB.deliveryError && itemB.deliveryError.length > 0);

    // audit history intact for both
    const audit = (await get(s.base, "/api/audit")).data.audit;
    assert.ok(audit.some((x: any) => x.itemId === a.data.item.id && x.action === "resolved"));
    assert.ok(audit.some((x: any) => x.itemId === b.data.item.id && x.action === "delivery_failed"));
  } finally {
    await s.close();
  }
});