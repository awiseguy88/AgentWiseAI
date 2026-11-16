import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import net from "net";
import { deliverResponse } from "../src/deliver";

test("delivers response to file", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-file-"));
  const target = path.join(dir, "out.json");
  const r = await deliverResponse({ id: 1, channel: "file", channelTarget: target, type: "approval", session: "s" }, { ok: true });
  assert.equal(r.ok, true);
  const written = JSON.parse(fs.readFileSync(target, "utf8"));
  assert.equal(written.itemId, 1);
  assert.deepEqual(written.response, { ok: true });
});

test("delivers response to callback", async () => {
  let received: any = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { received = JSON.parse(body); res.writeHead(200); res.end("ok"); });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  const r = await deliverResponse({ id: 2, channel: "callback", channelTarget: `http://127.0.0.1:${port}/cb`, type: "question", session: "s" }, "yes");
  assert.equal(r.ok, true);
  assert.equal(received.response, "yes");
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("delivers response to socket", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adt-sock-"));
  const sock = path.join(dir, "t.sock");
  let received: any = null;
  const server = net.createServer((socket) => {
    let data = "";
    socket.on("data", (c) => (data += c.toString()));
    socket.on("end", () => { received = JSON.parse(data.trim()); });
  });
  await new Promise<void>((resolve) => server.listen(sock, resolve));
  const r = await deliverResponse({ id: 3, channel: "socket", channelTarget: sock, type: "review", session: "s" }, { approved: true });
  assert.equal(r.ok, true);
  await new Promise((res) => setTimeout(res, 50));
  assert.equal(received.response.approved, true);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("unreachable callback fails with diagnostics after bounded retries", async () => {
  const r = await deliverResponse(
    { id: 4, channel: "callback", channelTarget: "http://127.0.0.1:9/nope", type: "approval", session: "s" },
    { ok: false },
    { maxAttempts: 3, baseDelayMs: 10, timeoutMs: 200 }
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.diagnostic.attempts, 3);
    assert.match(r.diagnostic.message, /Failed to deliver/);
    assert.ok(r.diagnostic.lastError);
  }
});