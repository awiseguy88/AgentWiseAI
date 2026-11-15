#!/usr/bin/env node
/**
 * Solo Site Rescue Kit — smoke check.
 *
 * Runs the full pipeline against the bundled fixture export in several modes:
 *   1. Offline mode  (no network, --offline)
 *   2. Loopback rescue (local HTTP server simulating remote images, then cache-only offline re-run)
 *   3. Next.js scaffold generation
 *
 * Prints PASS/FAIL per assertion and exits non-zero on failure.
 * No external network access is required; only a loopback server is used for step 2.
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, "fixtures", "export");
let passed = 0;
let failed = 0;
const failures = [];

function check(cond, label, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function readText(p) {
  try { return await fsp.readFile(p, "utf8"); } catch { return null; }
}

async function listFilesRecursive(dir) {
  const out = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

async function makeFixtureWithLocalImages() {
  // Create a temporary copy of the fixture export with local image files on disk.
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "ssrk-fixture-"));
  const dest = path.join(tmp, "export");
  await copyDir(ROOT, dest);
  const imagesDir = path.join(dest, "images");
  await fsp.mkdir(imagesDir, { recursive: true });
  // Minimal valid PNG (1x1 transparent).
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  for (const name of ["hero.jpg", "service-1.jpg", "service-2.jpg"]) {
    await fsp.writeFile(path.join(imagesDir, name), png);
  }
  return tmp;
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fsp.copyFile(s, d);
  }
}

async function startLoopbackServer() {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url.startsWith("/img/") && url.endsWith(".jpg")) {
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(png);
    } else if (url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>ok</body></html>");
    } else {
      res.writeHead(404); res.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return { server, base: `http://127.0.0.1:${port}` };
}

async function run(args, opts = {}) {
  const cli = path.join(__dirname, "src", "cli.js");
  const proc = (await import("node:child_process")).spawn(process.execPath, [cli, ...args], {
    env: { ...process.env, ...opts.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  proc.stdout.on("data", (d) => { stdout += d.toString(); });
  proc.stderr.on("data", (d) => { stderr += d.toString(); });
  const code = await new Promise((resolve) => proc.on("close", resolve));
  return { code, stdout, stderr };
}

async function main() {
  console.log("Solo Site Rescue Kit — smoke check\n");

  // ---- Step 1: Offline directory run ----
  console.log("[1/4] Offline directory run");
  const tmp1 = await makeFixtureWithLocalImages();
  const out1 = path.join(tmp1, "out");
  {
    const r = await run(["run", path.join(tmp1, "export"), "--out", out1, "--offline", "--no-git"]);
    check(r.code === 0, "offline run exits 0", `code=${r.code}${r.stderr ? ` stderr=${r.stderr.trim().split("\n")[0]}` : ""}`);
    const siteIndex = await readText(path.join(out1, "site", "index.html"));
    check(!!siteIndex && siteIndex.includes("Rescue Me Studio"), "static site index.html generated");
    check(await exists(path.join(out1, "assets", "images", "hero.jpg")), "local hero image copied to assets");
    check(await exists(path.join(out1, "MIGRATION-CHECKLIST.md")), "migration checklist written");
    check(await exists(path.join(out1, "rescue-data.json")), "rescue-data.json written");
    check(await exists(path.join(out1, "report.html")), "report.html written (not skipped)");
    // Remote URLs should be reported as unrecoverable in offline mode.
    const dataText = await readText(path.join(out1, "rescue-data.json"));
    let data = null;
    try { data = JSON.parse(dataText || "null"); } catch { data = null; }
    check(!!data && Array.isArray(data.images), "rescue-data.json has images array");
    if (data) {
      const remote = data.images.filter((i) => /^https?:/.test(i.url || ""));
      const missingRemote = remote.filter((i) => i.status === "missing");
      check(remote.length > 0, "fixture contains remote image URLs");
      check(missingRemote.length === remote.length, "all remote images missing in offline mode", `${missingRemote.length}/${remote.length}`);
    }
  }
  await fsp.rm(tmp1, { recursive: true, force: true });

  // ---- Step 2: Loopback rescue + cache re-use ----
  console.log("[2/4] Loopback rescue + cache");
  const tmp2 = await fsp.mkdtemp(path.join(os.tmpdir(), "ssrk-loop-"));
  const exportDir2 = path.join(tmp2, "export");
  await fsp.mkdir(exportDir2, { recursive: true });
  const { server, base } = await startLoopbackServer();
  try {
    // Write an HTML page referencing loopback images.
    const html = `<!DOCTYPE html><html><body><h1>Loopback</h1><img src="${base}/img/hero.jpg" alt="hero"><img src="${base}/img/service-1.jpg" alt="s1"></body></html>`;
    await fsp.writeFile(path.join(exportDir2, "index.html"), html);
    const out2 = path.join(tmp2, "out");
    const r = await run(["run", exportDir2, "--out", out2, "--no-git", "--no-report"]);
    check(r.code === 0, "loopback run exits 0", `code=${r.code}${r.stderr ? ` stderr=${r.stderr.trim().split("\n")[0]}` : ""}`);
    const siteHtml = await readText(path.join(out2, "site", "index.html"));
    check(!!siteHtml && !siteHtml.includes(base), "remote URLs rewritten to local paths");
    const assets = await listFilesRecursive(path.join(out2, "assets", "images")).catch(() => []);
    check(assets.length >= 2, "loopback images rescued into assets/images", `${assets.length} file(s)`);
    // Offline re-run should hit cache.
    const r2 = await run(["run", exportDir2, "--out", path.join(tmp2, "out2"), "--offline", "--no-git", "--no-report", "--cache-dir", path.join(out2, ".rescue-cache")]);
    check(r2.code === 0, "cache-only offline re-run exits 0");
    const data2Text = await readText(path.join(tmp2, "out2", "rescue-data.json"));
    let data2 = null; try { data2 = JSON.parse(data2Text || "null"); } catch { data2 = null; }
    if (data2) {
      const rescued = data2.images.filter((i) => i.status === "rescued");
      check(rescued.length >= 2, "cache re-run rescues from cache");
    } else {
      check(false, "cache re-run rescue-data.json parseable");
    }
  } finally {
    await new Promise((r) => server.close(r));
    await fsp.rm(tmp2, { recursive: true, force: true });
  }

  // ---- Step 3: Next.js scaffold ----
  console.log("[3/4] Next.js scaffold");
  const tmp3 = await makeFixtureWithLocalImages();
  const out3 = path.join(tmp3, "out-next");
  {
    const r = await run(["run", path.join(tmp3, "export"), "--out", out3, "--format", "next", "--offline", "--no-git", "--no-report"]);
    check(r.code === 0, "next scaffold run exits 0", `code=${r.code}${r.stderr ? ` stderr=${r.stderr.trim().split("\n")[0]}` : ""}`);
    check(await exists(path.join(out3, "next-app", "app", "layout.js")), "next-app/app/layout.js exists");
    check(await exists(path.join(out3, "next-app", "app", "page.jsx")), "next-app/app/page.jsx exists");
    check(await exists(path.join(out3, "next-app", "package.json")), "next-app/package.json exists");
  }
  await fsp.rm(tmp3, { recursive: true, force: true });

  // ---- Step 4: Git commit ----
  console.log("[4/4] Local git commit");
  const tmp4 = await makeFixtureWithLocalImages();
  const out4 = path.join(tmp4, "out-git");
  {
    const r = await run(["run", path.join(tmp4, "export"), "--out", out4, "--offline", "--no-report", "--git-author", "Smoke Test <smoke@example.com>"]);
    check(r.code === 0, "git run exits 0");
    check(await exists(path.join(out4, ".git")), "output git repo initialized");
    // Run git log inside out4
    const gitLog = (await import("node:child_process")).spawnSync("git", ["-C", out4, "log", "-1", "--format=%an <%ae>"], { encoding: "utf8" });
    check(gitLog.status === 0 && (gitLog.stdout || "").includes("Smoke Test"), "git commit created with runtime author", gitLog.stdout?.trim());
  }
  await fsp.rm(tmp4, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failures:", failures.join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke check crashed:", err);
  process.exit(1);
});