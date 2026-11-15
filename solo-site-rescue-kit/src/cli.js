/**
 * Solo Site Rescue Kit — CLI.
 *
 * Usage:
 *   solo-rescue run <export-path> [options]
 *   solo-rescue ingest <export-path>
 *   solo-rescue report --from <output-dir>
 *   solo-rescue help
 *   solo-rescue --version
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ingestDirectory, ingestZip } from "./ingest.js";
import { extractInventory } from "./extract.js";
import { rescueImages } from "./rescue.js";
import { buildUrlMap, rewritePages } from "./rewrite.js";
import { buildStaticSite, buildNextSite } from "./build.js";
import { generateReportHtml } from "./report.js";
import { generateChecklist } from "./checklist.js";
import { commitOutput } from "./git.js";
import { ensureDir, writeText } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp() {
  console.log(`Solo Site Rescue Kit v${getVersion()}

Usage:
  solo-rescue run <export-path> [options]     Ingest, rescue, build, report, commit
  solo-rescue ingest <export-path>            Print inventory summary only
  solo-rescue report --from <output-dir>      Regenerate report from rescue-data.json
  solo-rescue help | --help                   Show this help
  solo-rescue --version                       Print version

Options (run):
  --out <dir>             Output directory (default: <export>.rescued)
  --format <kind>         "static" (default) or "next"
  --offline               Do not fetch remote assets; use cache only
  --no-git                Skip git init/commit of the output
  --no-report             Skip writing report.html
  --mask-submissions      Omit submission field values from report (data file kept)
  --timeout <ms>          Fetch timeout per image (default: 8000)
  --retries <n>           Fetch retry count (default: 1)
  --concurrency <n>       Parallel fetches (default: 4)
  --cache-dir <dir>       Override rescue cache directory
  --title <text>          Site title (used by Next.js scaffold)
  --git-author "N <e>"    Commit author "Name <email>" (overrides env)

Notes:
  - No paid APIs. Network is best-effort for remote image rescue only.
  - Works offline: unrecoverable remote assets are reported, not fatal.
  - Use --offline to guarantee no network access.
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { args.help = true; continue; }
    if (a === "--version" || a === "-v") { args.version = true; continue; }
    if (a === "--offline") { args.offline = true; continue; }
    if (a === "--no-git") { args.noGit = true; continue; }
    if (a === "--no-report") { args.noReport = true; continue; }
    if (a === "--mask-submissions") { args.maskSubmissions = true; continue; }
    if (a.startsWith("--") && i + 1 < argv.length) {
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[++i];
      continue;
    }
    args._.push(a);
  }
  return args;
}

async function ingestPath(inputPath) {
  const resolved = path.resolve(inputPath);
  let stat;
  try { stat = await fsp.stat(resolved); } catch { throw new Error(`Input not found: ${resolved}`); }
  if (stat.isDirectory()) return ingestDirectory(resolved);
  if (stat.isFile() && resolved.toLowerCase().endsWith(".zip")) return ingestZip(resolved);
  throw new Error(`Unsupported input: ${resolved} (expected a directory or .zip file)`);
}

function summarizeInventory(inv) {
  return { pages: inv.html.length, csv: inv.csv.length, json: inv.json.length, images: inv.images.length, other: inv.other.length, total: inv.all.length };
}

export async function runPipeline(inputPath, opts = {}) {
  const sourcePath = path.resolve(inputPath);
  const outDir = path.resolve(opts.out || `${sourcePath.replace(/\.zip$/i, "")}.rescued`);
  const format = opts.format || "static";
  const offline = !!opts.offline;
  const timeoutMs = Number(opts.timeout || 8000);
  const retries = Number(opts.retries ?? 1);
  const concurrency = Number(opts.concurrency || 4);
  const cacheDir = opts.cacheDir ? path.resolve(opts.cacheDir) : path.join(outDir, ".rescue-cache");

  await ensureDir(outDir);

  const inventory = await ingestPath(sourcePath);
  const extraction = await extractInventory(inventory);

  // Copy local image files found in the export into assets/images so pages can reference them.
  for (const img of inventory.images) {
    try {
      const src = img.source === "directory" ? img.absolutePath : null;
      if (src) {
        const dest = path.join(outDir, "assets", "images", path.basename(img.path));
        await ensureDir(path.dirname(dest));
        await fsp.copyFile(src, dest);
      }
    } catch {
      // best-effort
    }
  }

  const rescueSummary = await rescueImages(extraction, { outDir, cacheDir, offline, timeoutMs, retries, concurrency });
  const urlMap = buildUrlMap(extraction);
  const rewrittenPages = rewritePages(extraction, urlMap);

  let buildResult;
  if (format === "next") {
    buildResult = await buildNextSite({ outDir, rewrittenPages, submissions: extraction.submissions, options: opts });
  } else {
    buildResult = await buildStaticSite({ outDir, rewrittenPages, submissions: extraction.submissions, options: opts });
  }

  const runMeta = { sourcePath, outDir, format, offline, startedAt: new Date().toISOString() };

  // rescue-data.json
  const rescueData = {
    run: runMeta,
    inventory: summarizeInventory(inventory),
    rescue: rescueSummary,
    build: buildResult,
    pages: extraction.pages.map((p) => ({ path: p.path, name: p.name })),
    submissionsCount: extraction.submissions.length,
    images: extraction.images.map((i) => ({ url: i.url, status: i.status, localPath: i.localPath, page: i.page, context: i.context })),
  };
  await writeText(path.join(outDir, "rescue-data.json"), JSON.stringify(rescueData, null, 2));

  // Checklist
  const checklist = generateChecklist({ run: runMeta, inventory, extraction, rescueSummary, buildResult, options: { offline } });
  await writeText(path.join(outDir, "MIGRATION-CHECKLIST.md"), checklist);

  // Report
  if (!opts.noReport) {
    const reportHtml = generateReportHtml({ run: runMeta, inventory, extraction, rescueSummary, buildResult, options: opts });
    await writeText(path.join(outDir, "report.html"), reportHtml);
  }

  // Git commit
  let gitResult = { committed: false, reason: "skipped (--no-git)" };
  if (!opts.noGit) {
    const author = parseAuthor(opts.gitAuthor);
    gitResult = await commitOutput(outDir, { authorName: author?.name, authorEmail: author?.email });
  }

  return { run: runMeta, inventory, extraction, rescueSummary, buildResult, gitResult, outDir };
}

function parseAuthor(str) {
  if (!str) return null;
  const m = /^(.+?)\s*<([^>]+)>$/.exec(str.trim());
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: str.trim(), email: null };
}

async function cmdRun(args) {
  const inputPath = args._[1];
  if (!inputPath) { console.error("Error: missing <export-path>"); process.exit(2); }
  try {
    const result = await runPipeline(inputPath, args);
    const inv = summarizeInventory(result.inventory);
    const res = result.rescueSummary;
    console.log("Solo Site Rescue Kit — run complete");
    console.log(`  Source:   ${result.run.sourcePath}`);
    console.log(`  Output:   ${result.outDir}`);
    console.log(`  Format:   ${result.buildResult?.kind}`);
    console.log(`  Pages:    ${inv.pages} | CSV: ${inv.csv} | JSON: ${inv.json} | Images found: ${inv.images}`);
    console.log(`  Rescued:  ${res.succeeded} (cached: ${res.cached}) | Failed: ${res.failed} | Data-URI: ${res.dataUri} | Local refs: ${res.local}`);
    console.log(`  Submissions: ${result.extraction.submissions.length}`);
    console.log(`  Git:      ${result.gitResult.committed ? `committed ${result.gitResult.hash?.slice(0, 12)}` : result.gitResult.reason || "skipped"}`);
    if (res.failed > 0) {
      console.log(`  Note: ${res.failed} asset(s) could not be recovered. See report.html and MIGRATION-CHECKLIST.md.`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdIngest(args) {
  const inputPath = args._[1];
  if (!inputPath) { console.error("Error: missing <export-path>"); process.exit(2); }
  try {
    const inv = await ingestPath(inputPath);
    console.log(JSON.stringify(summarizeInventory(inv), null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdReport(args) {
  const from = args.from;
  if (!from) { console.error("Error: --from <output-dir> required"); process.exit(2); }
  try {
    const dataPath = path.join(path.resolve(from), "rescue-data.json");
    const raw = await fsp.readFile(dataPath, "utf8");
    const data = JSON.parse(raw);
    // Minimal regeneration using stored data shape.
    const reportHtml = generateReportHtml({
      run: data.run,
      inventory: { html: new Array(data.inventory?.pages || 0), csv: [], json: [], images: [], other: [], all: [] },
      extraction: { pages: data.pages || [], submissions: new Array(data.submissionsCount || 0), images: data.images || [] },
      rescueSummary: data.rescue || {},
      buildResult: data.build || null,
      options: {},
    });
    await writeText(path.join(path.resolve(from), "report.html"), reportHtml);
    console.log(`Report regenerated: ${path.join(path.resolve(from), "report.html")}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) { console.log(getVersion()); return; }
  if (args.help || args._.length === 0) { printHelp(); return; }
  const cmd = args._[0];
  if (cmd === "run") return cmdRun(args);
  if (cmd === "ingest") return cmdIngest(args);
  if (cmd === "report") return cmdReport(args);
  if (cmd === "help") { printHelp(); return; }
  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exit(2);
}

main();
