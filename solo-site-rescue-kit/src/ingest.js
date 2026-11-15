/**
 * Solo Site Rescue Kit — ingestion.
 *
 * Scans an export directory or a .zip export archive and produces an inventory of
 * classified files: HTML pages, CSV tables, JSON files, images, and other assets.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { readZipEntry, readAllZipEntries, parseZip, normalizeZipName } from "./unzip.js";
import { readText, ensureDir } from "./utils.js";

const HTML_EXTS = new Set([".html", ".htm"]);
const CSV_EXTS = new Set([".csv"]);
const JSON_EXTS = new Set([".json"]);
const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".bmp", ".avif", ".tif", ".tiff",
]);

export class SourceLocation {
  constructor(kind, path) {
    this.kind = kind; // "directory" | "zip"
    this.path = path;
  }
}

/**
 * Inventory of everything found in the export, grouped by classification.
 */
export class Inventory {
  constructor(source) {
    this.source = source;
    this.html = [];    // { path, name, size, absolutePath / zipName }
    this.csv = [];     // { path, name, size, ... }
    this.json = [];    // { path, name, size, ... }
    this.images = [];  // { path, name, size, ... }
    this.other = [];   // { path, name, size, ... }
    this.all = [];     // every file entry, { path, name, size, kind, source }
  }

  add(entry) {
    this.all.push(entry);
    const kind = entry.kind;
    if (kind === "html") this.html.push(entry);
    else if (kind === "csv") this.csv.push(entry);
    else if (kind === "json") this.json.push(entry);
    else if (kind === "image") this.images.push(entry);
    else this.other.push(entry);
  }
}

function classifyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  if (HTML_EXTS.has(ext)) return "html";
  if (CSV_EXTS.has(ext)) return "csv";
  if (JSON_EXTS.has(ext)) return "json";
  if (IMAGE_EXTS.has(ext)) return "image";
  return "other";
}

/** Ingest a directory on disk into an Inventory. */
export async function ingestDirectory(dirPath) {
  const source = new SourceLocation("directory", dirPath);
  const inventory = new Inventory(source);
  const files = await collectDirectoryFiles(dirPath);
  for (const relPath of files) {
    const fullPath = path.join(dirPath, relPath);
    let size = 0;
    try {
      size = (await fs.promises.stat(fullPath)).size;
    } catch {
      size = 0;
    }
    inventory.add({
      path: relPath,
      name: path.basename(relPath),
      size,
      kind: classifyFile(relPath),
      absolutePath: fullPath,
      source: "directory",
    });
  }
  return inventory;
}

async function collectDirectoryFiles(dirPath) {
  const results = [];
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const children = await collectDirectoryFiles(full);
      for (const child of children) {
        results.push(path.join(entry.name, child));
      }
    } else if (entry.isFile()) {
      results.push(entry.name);
    }
  }
  return results.sort();
}

/** Ingest a .zip file into an Inventory. All file contents are held in memory. */
export async function ingestZip(zipPath) {
  const source = new SourceLocation("zip", zipPath);
  const inventory = new Inventory(source);
  const buffer = await fs.promises.readFile(zipPath);
  const { entries } = parseZip(buffer);
  for (const entry of entries) {
    const name = normalizeZipName(entry.name);
    if (name.endsWith("/")) continue; // directory entry
    inventory.add({
      path: name,
      name: path.basename(name),
      size: entry.uncompressedSize,
      kind: classifyFile(name),
      zipName: name,
      zipPath: zipPath,
      source: "zip",
    });
  }
  return inventory;
}

/** Resolve a file entry's content to a Buffer. */
export async function readInventoryEntry(entry) {
  if (entry.source === "directory") {
    return await fs.promises.readFile(entry.absolutePath);
  }
  if (entry.source === "zip") {
    const buffer = await fs.promises.readFile(entry.zipPath);
    return await readZipEntry(buffer, entry.zipName);
  }
  throw new Error(`Unknown source kind: ${entry.source}`);
}

/** Read an inventory entry as UTF-8 text. */
export async function readInventoryText(entry) {
  const buf = await readInventoryEntry(entry);
  return buf.toString("utf8");
}

/** Detect whether a file path looks like a CSV of image links vs submissions. */
export function detectCsvKind(text, fileName) {
  const lower = fileName.toLowerCase();
  const firstLine = text.split("\n")[0] || "";
  const lowerLine = firstLine.toLowerCase();
  const imageColumns = /(image|img|photo|picture|url|link|src|attachment)/i;
  const submissionColumns = /(email|name|message|contact|newsletter|submitted|phone|address)/i;
  if (lower.includes("image") || lower.includes("img") || imageColumns.test(lowerLine)) {
    return "images";
  }
  if (lower.includes("submission") || lower.includes("contact") || lower.includes("newsletter") || submissionColumns.test(lowerLine)) {
    return "submissions";
  }
  return "unknown";
}
