import fs from "fs";
import http from "http";
import https from "https";
import net from "net";
import path from "path";
import type { DecisionItem, DeliveryDiagnostic } from "./types";

export interface DeliverOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function postJson(urlStr: string, payload: unknown, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = JSON.stringify(payload);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`Callback responded with HTTP ${res.statusCode}`));
      }
    );
    req.on("timeout", () => req.destroy(new Error("Callback request timed out")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function writeFileResponse(target: string, payload: unknown): Promise<void> {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return Promise.resolve();
}

function writeSocketResponse(target: string, payload: unknown, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(target, () => {
      client.write(JSON.stringify(payload) + "\n");
      client.end();
    });
    client.setTimeout(timeoutMs, () => client.destroy(new Error("Socket delivery timed out")));
    client.on("error", reject);
    client.on("close", (hadErr) => {
      if (!hadErr) resolve();
    });
  });
}

export async function deliverResponse(
  item: Pick<DecisionItem, "id" | "channel" | "channelTarget" | "type" | "session">,
  response: unknown,
  opts: DeliverOptions = {}
): Promise<{ ok: true; attempts: number } | { ok: false; diagnostic: DeliveryDiagnostic }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 150;
  const timeoutMs = opts.timeoutMs ?? 1500;
  const payload = {
    itemId: item.id,
    type: item.type,
    session: item.session,
    response,
    deliveredAt: new Date().toISOString(),
  };

  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (item.channel === "callback") await postJson(item.channelTarget, payload, timeoutMs);
      else if (item.channel === "file") await writeFileResponse(item.channelTarget, payload);
      else if (item.channel === "socket") await writeSocketResponse(item.channelTarget, payload, timeoutMs);
      else throw new Error(`Unsupported channel: ${String(item.channel)}`);
      return { ok: true, attempts: attempt };
    } catch (e: any) {
      lastError = e?.message || String(e);
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * attempt);
      }
    }
  }
  return {
    ok: false,
    diagnostic: {
      code: "delivery_failed",
      message: `Failed to deliver response to ${item.channel}:${item.channelTarget} after ${maxAttempts} attempt(s).`,
      attempts: maxAttempts,
      lastError,
    },
  };
}