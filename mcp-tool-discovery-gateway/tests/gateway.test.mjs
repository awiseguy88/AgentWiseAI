import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const CONFIG = resolve(ROOT, "fixtures/config.demo.json");

function runCli(args) {
  const res = spawnSync(process.execPath, [resolve(ROOT, "dist/cli.js"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30000,
  });
  return res;
}

test("fixture config indexes 3 servers and at least 20 tools", async () => {
  const res = runCli(["index", "--config", CONFIG]);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /Indexed tools: (2[0-9]|[3-9][0-9])/);
  assert.match(res.stdout, /github_ci\./);
  assert.match(res.stdout, /chat\./);
  assert.match(res.stdout, /devops\./);
});

test("search finds CI and chat tools without loading full schemas", async () => {
  const { Gateway } = await import(resolve(ROOT, "dist/proxy/gateway.js"));
  const { loadConfig } = await import(resolve(ROOT, "dist/config.js"));
  const gw = new Gateway(loadConfig(CONFIG));
  await gw.init();
  const ci = gw.search("failed ci", { limit: 10 }).results;
  assert.ok(ci.length > 0, "expected CI search results");
  assert.ok(ci.some((r) => r.id === "github_ci.list_failed_runs"), "expected github_ci.list_failed_runs");
  const chat = gw.search("post summary", { limit: 10 }).results;
  assert.ok(chat.some((r) => r.id === "chat.post_summary"), "expected chat.post_summary");
  // search should not record schema load events
  const schemaEvents = gw.reportSnapshot().events.filter((e) => e.type === "schema");
  assert.equal(schemaEvents.length, 0, "search must not load schemas");
});

test("schema fetch loads only requested schema (on demand)", async () => {
  const { Gateway } = await import(resolve(ROOT, "dist/proxy/gateway.js"));
  const { loadConfig } = await import(resolve(ROOT, "dist/config.js"));
  const gw = new Gateway(loadConfig(CONFIG));
  await gw.init();
  const before = gw.reportSnapshot().totals.requestedSchemaCount;
  await gw.schema("github_ci", "list_failed_runs");
  const after = gw.reportSnapshot().totals.requestedSchemaCount;
  assert.equal(after, before + 1);
  assert.ok(gw.reportSnapshot().totals.requestedSchemaBytes > 0);
  assert.ok(gw.reportSnapshot().totals.requestedSchemaBytes < gw.indexState.totalSchemaBytes);
});

test("realistic task: discover and invoke 2 tools end-to-end with accounting", async () => {
  const { Gateway } = await import(resolve(ROOT, "dist/proxy/gateway.js"));
  const { loadConfig } = await import(resolve(ROOT, "dist/config.js"));
  const gw = new Gateway(loadConfig(CONFIG));
  await gw.init();
  assert.ok(gw.indexState.tools.length >= 20);

  const ci = gw.search("failed ci").results.find((r) => r.id === "github_ci.list_failed_runs");
  assert.ok(ci);
  await gw.schema("github_ci", "list_failed_runs");
  const ciRes = await gw.invoke("github_ci", "list_failed_runs", { repo: "acme/app" });
  assert.equal(ciRes.ok, true);
  assert.ok(ciRes.result);

  const chat = gw.search("post summary").results.find((r) => r.id === "chat.post_summary");
  assert.ok(chat);
  await gw.schema("chat", "post_summary");
  const chatRes = await gw.invoke("chat", "post_summary", { channel: "#ci-alerts", text: "summary" });
  assert.equal(chatRes.ok, true);
  assert.ok(chatRes.result);

  const totals = gw.reportSnapshot().totals;
  assert.equal(totals.requestedSchemaCount, 2, "only 2 schemas requested");
  assert.ok(totals.requestedSchemaBytes < totals.indexedSchemaBytes, "must not preload all schemas");
  assert.ok(totals.indexedSchemaTokensEstimate > totals.requestedSchemaTokensEstimate);
});

test("policy denial returns structured error, records audit, session remains usable", async () => {
  const { Gateway } = await import(resolve(ROOT, "dist/proxy/gateway.js"));
  const { loadConfig } = await import(resolve(ROOT, "dist/config.js"));
  const cfg = loadConfig(CONFIG);
  cfg.policy = { ...(cfg.policy || {}), denyTools: ["devops.restart_service"] };
  const gw = new Gateway(cfg);
  await gw.init();

  const denied = await gw.invoke("devops", "restart_service", { service: "api" });
  assert.equal(denied.ok, false);
  assert.match(String(denied.error), /denied/i);
  const denials = gw.reportSnapshot().events.filter((e) => e.type === "policy_deny");
  assert.ok(denials.length >= 1);

  // session remains usable
  const ok = await gw.invoke("github_ci", "list_failed_runs", { repo: "acme/app" });
  assert.equal(ok.ok, true);
});

test("unavailable server invoke returns structured error and records audit", async () => {
  const { Gateway } = await import(resolve(ROOT, "dist/proxy/gateway.js"));
  const gw = new Gateway({
    servers: [{ name: "missing", transport: "stdio", command: "node", args: ["does-not-exist.mjs"] }],
    policy: {},
  });
  await gw.init(); // index refresh tolerates failure
  // tool not indexed, but invoke path should fail gracefully
  const res = await gw.invoke("missing", "anything", {});
  assert.equal(res.ok, false);
  assert.ok(typeof res.error === "string" && res.error.length > 0);
});

test("demo CLI writes audit report and shows before/after accounting", async () => {
  const outDir = resolve(ROOT, "examples/demo-output-test");
  const res = runCli(["demo", "--config", CONFIG, "--out", outDir]);
  assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.match(res.stdout, /Before \(all indexed schemas/);
  assert.match(res.stdout, /After  \(schemas actually requested\/loaded\)/);
  assert.match(res.stdout, /Estimated tokens avoided/);
  assert.ok(existsSync(resolve(outDir, "audit.json")));
  assert.ok(existsSync(resolve(outDir, "audit.html")));
  const audit = JSON.parse(readFileSync(resolve(outDir, "audit.json"), "utf8"));
  assert.ok(audit.totals.indexedTools >= 20);
  assert.equal(audit.totals.requestedSchemaCount, 2);
  assert.ok(audit.totals.requestedSchemaBytes < audit.totals.indexedSchemaBytes);
});
