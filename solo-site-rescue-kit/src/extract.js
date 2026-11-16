/**
 * Solo Site Rescue Kit — extraction.
 *
 * Extracts image references and contact/newsletter submissions from the files in an
 * inventory. Produces a normalized extraction result consumed by rescue, rewrite, build
 * and report modules.
 */

import * as path from "node:path";
import { isImageUrl, isDataUri, parseDataUri, resolveUrl, jsonEscapeForHtml } from "./utils.js";
import { readInventoryText } from "./ingest.js";

/** A single extracted image reference. */
export class ImageRef {
  constructor({ source, url, kind, context, page, line, column, descriptor }) {
    this.source = source;     // "html" | "css" | "csv" | "json"
    this.url = url;           // original URL string
    this.kind = kind;         // "img-src" | "srcset" | "css-url" | "csv-column" | "json-string"
    this.context = context;   // attribute name or column name
    this.page = page;         // source file path (html page it belongs to)
    this.line = line;         // approx source line
    this.column = column;     // approx source column
    this.descriptor = descriptor; // srcset descriptor (e.g. "2x") or null
    this.resolved = null;     // absolute URL (set during resolution)
    this.localPath = null;    // rewritten local path (set during rewrite)
    this.status = "pending";  // pending | rescued | skipped | missing | data-uri | local
  }
}

/** A single submission row from CSV/JSON contact/newsletter data. */
export class Submission {
  constructor({ source, fields, page, row }) {
    this.source = source; // "csv" | "json"
    this.fields = fields; // object of column -> value
    this.page = page;     // source file path
    this.row = row;       // row index
  }
}

/** Full extraction result. */
export class Extraction {
  constructor() {
    this.images = [];   // ImageRef[]
    this.submissions = []; // Submission[]
    this.pages = [];    // { path, name, html }
    this.cssFiles = []; // { path, name, css }
    this.csvTables = []; // { path, name, headers, rows }
    this.jsonFiles = []; // { path, name, data }
  }
}

/** ---------------------------------------------------------------- HTML/CSS */

const TAG_ATTRS = {
  img: ["src", "data-src", "data-original", "data-lazy-src"],
  source: ["srcset", "src"],
  video: ["poster"],
  iframe: ["src"],
  script: ["src"],
  link: ["href"],
};
const URL_ATTRS = new Set([
  "src", "data-src", "data-original", "data-lazy-src", "srcset", "poster", "href",
]);
const CSS_URL_RE = /url\(\s*(['"]?)([^)'"]+)\1?\s*\)/gi;
const SRCSET_ENTRY_RE = /(\S+)\s+([0-9.]+(?:x|w)|[0-9]+)?/g;

/** Extract image references from an HTML string. */
export function extractFromHtml(html, page) {
  const extraction = new Extraction();
  extraction.pages.push({ path: page, name: path.basename(page), html });

  let line = 1;
  let column = 1;
  let pos = 0;

  // Track whether we are inside a <style> block to extract CSS url(...).
  let inStyle = false;

  while (pos < html.length) {
    const ch = html[pos];

    // Track line/column for error reporting.
    if (ch === "\n") { line++; column = 1; pos++; continue; }
    if (ch === "\r") { pos++; continue; }
    column++;

    // Tag open.
    if (ch === "<") {
      const close = html.indexOf(">", pos);
      if (close === -1) break;

      const tagContent = html.slice(pos + 1, close);
      const isClosing = tagContent.trim().startsWith("/");
      const tagMatch = /^\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tagContent);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : null;

      if (tagName === "style" && !isClosing) {
        inStyle = true;
      } else if (tagName === "/style") {
        inStyle = false;
      } else if (inStyle) {
        // Inside <style>: extract css url(...).
        collectCssUrls(html.slice(pos, close + 1), page, extraction, line, column);
      } else if (tagName && TAG_ATTRS[tagName]) {
        // Extract URL attributes.
        for (const attr of TAG_ATTRS[tagName]) {
          const attrMatch = new RegExp(
            `${attr}\\s*=\\s*(['"])([^'"]*?)\\1`,
            "i"
          ).exec(tagContent);
          if (attrMatch) {
            const value = attrMatch[2];
            if (attr === "srcset") {
              collectSrcset(value, page, extraction, line, column);
            } else {
              addImageRef(extraction, value, page, attr, line, column);
            }
          }
        }
      }

      pos = close + 1;
      continue;
    }

    // Inside a <style> block but not at a tag boundary: scan text for CSS url().
    if (inStyle) {
      const nextTag = html.indexOf("<", pos);
      const scanEnd = nextTag === -1 ? html.length : nextTag;
      collectCssUrls(html.slice(pos, scanEnd), page, extraction, line, column);
      pos = scanEnd;
      continue;
    }

    pos++;
  }

  return extraction;
}

function collectCssUrls(text, page, extraction, line, column) {
  let match;
  CSS_URL_RE.lastIndex = 0;
  while ((match = CSS_URL_RE.exec(text)) !== null) {
    const url = match[2];
    addImageRef(extraction, url, page, "css-url", line, column);
  }
}

function collectSrcset(value, page, extraction, line, column) {
  const parts = value.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = SRCSET_ENTRY_RE.exec(trimmed);
    if (match) {
      const url = match[1];
      const descriptor = match[2] || null;
      addImageRef(extraction, url, page, "srcset", line, column, descriptor);
    }
  }
}

function addImageRef(extraction, url, page, context, line, column, descriptor) {
  if (!url || isDataUri(url)) {
    extraction.images.push(
      new ImageRef({ source: "html", url, kind: "data-uri", context, page, line, column, descriptor, status: "data-uri" })
    );
    return;
  }
  extraction.images.push(
    new ImageRef({ source: "html", url, kind: context, context, page, line, column, descriptor, status: "pending" })
  );
}

/** ---------------------------------------------------------------- CSV */

/** Very small CSV parser handling quoted fields and CRLF/LF. */
export function parseCsv(text) {
  const rows = [];
  let i = 0;
  const n = text.length;
  let current = [];
  let field = "";
  let inQuotes = false;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < n && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { current.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; if (i < n && text[i] === "\n") i++; current.push(field); field = ""; rows.push(current); current = []; continue; }
    if (ch === "\n") { current.push(field); field = ""; rows.push(current); current = []; i++; continue; }
    field += ch; i++;
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}

export function extractFromCsv(text, page, fileName) {
  const extraction = new Extraction();
  const rows = parseCsv(text);
  if (rows.length === 0) return extraction;

  const headers = rows[0].map((h) => h.trim());
  const csvKind = detectCsvKind(text, fileName);
  extraction.csvTables.push({ path: page, name: path.basename(page), headers, rows: rows.slice(1) });

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const fields = {};
    for (let c = 0; c < headers.length; c++) {
      fields[headers[c]] = row[c] !== undefined ? row[c] : "";
    }

    if (csvKind === "submissions" || csvKind === "unknown") {
      extraction.submissions.push(new Submission({ source: "csv", fields, page, row: r }));
    }

    if (csvKind === "images" || csvKind === "unknown") {
      for (const [header, value] of Object.entries(fields)) {
        if (!value || value.trim() === "") continue;
        const trimmed = value.trim();
        if (isImageUrl(trimmed) || looksLikeUrl(trimmed)) {
          extraction.images.push(
            new ImageRef({ source: "csv", url: trimmed, kind: "csv-column", context: header, page, line: r + 1, column: 1, status: "pending" })
          );
        }
      }
    }
  }

  return extraction;
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value) || /^\//.test(value);
}

function detectCsvKind(text, fileName) {
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

/** ---------------------------------------------------------------- JSON */

/** Walk a JSON value, collecting string values that look like URLs or submissions. */
export function extractFromJson(data, page, fileName) {
  const extraction = new Extraction();
  extraction.jsonFiles.push({ path: page, name: path.basename(fileName), data });

  const walk = (value, keyPath) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      if (isDataUri(value)) {
        extraction.images.push(
          new ImageRef({ source: "json", url: value, kind: "data-uri", context: keyPath, page, line: 1, column: 1, status: "data-uri" })
        );
      } else if (looksLikeUrl(value) && isImageUrl(value)) {
        extraction.images.push(
          new ImageRef({ source: "json", url: value, kind: "json-string", context: keyPath, page, line: 1, column: 1, status: "pending" })
        );
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, idx) => walk(v, `${keyPath}[${idx}]`));
      return;
    }
    if (typeof value === "object") {
      // Detect a submission-like object: contains email/name/message-ish keys.
      const keys = Object.keys(value);
      const submissionish = /(email|name|message|contact|newsletter|phone)/i.test(keys.join(" "));
      if (submissionish && keys.some((k) => /email/i.test(k))) {
        extraction.submissions.push(new Submission({ source: "json", fields: value, page, row: 1 }));
      }
      for (const k of keys) {
        walk(value[k], keyPath ? `${keyPath}.${k}` : k);
      }
    }
  };

  walk(data, "");
  return extraction;
}

/** ---------------------------------------------------------------- Combine */

/** Run all extractors over an inventory's readable files. */
export async function extractInventory(inventory) {
  const extraction = new Extraction();

  for (const entry of inventory.html) {
    const text = await readTextFromEntry(entry);
    const part = extractFromHtml(text, entry.path);
    extraction.images.push(...part.images);
    extraction.pages.push(...part.pages);
  }

  for (const entry of inventory.csv) {
    const text = await readTextFromEntry(entry);
    const part = extractFromCsv(text, entry.path, entry.name);
    extraction.images.push(...part.images);
    extraction.submissions.push(...part.submissions);
    extraction.csvTables.push(...part.csvTables);
  }

  for (const entry of inventory.json) {
    const text = await readTextFromEntry(entry);
    let data;
    try { data = JSON.parse(text); } catch { data = { _raw: text }; }
    const part = extractFromJson(data, entry.path, entry.name);
    extraction.images.push(...part.images);
    extraction.submissions.push(...part.submissions);
    extraction.jsonFiles.push(...part.jsonFiles);
  }

  // Deduplicate identical image URLs (keep first occurrence).
  const seen = new Set();
  extraction.images = extraction.images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  return extraction;
}

async function readTextFromEntry(entry) {
  return readInventoryText(entry);
}
