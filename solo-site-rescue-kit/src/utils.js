/**
 * Solo Site Rescue Kit — shared utilities.
 *
 * Zero-dependency, pure Node.js helpers used by every module: filesystem operations,
 * path normalization, content-addressed hashing, and URL handling.
 */

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import * as zlib from "node:zlib";

export const FILE_SENTINEL = "\0";

/** Read a file as a Buffer (async). */
export async function readFile(filePath) {
  return fsPromises.readFile(filePath);
}

/** Read a file as UTF-8 text (async). */
export async function readText(filePath) {
  const buf = await readFile(filePath);
  return buf.toString("utf8");
}

/** Write a Buffer to a file, creating parent directories (async). */
export async function writeFile(filePath, data) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  return fsPromises.writeFile(filePath, data);
}

/** Write UTF-8 text to a file, creating parent directories (async). */
export async function writeText(filePath, text) {
  return writeFile(filePath, Buffer.from(text, "utf8"));
}

/** Ensure a directory exists (async). */
export async function ensureDir(dirPath) {
  return fsPromises.mkdir(dirPath, { recursive: true });
}

/** List entries of a directory, returning relative file paths (async). */
export async function listFiles(dirPath) {
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      for (const child of await listFiles(full)) {
        files.push(path.join(entry.name, child));
      }
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files;
}

/** Normalize a path: strip trailing separators and resolve `..`/`..` safely. */
export function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Join path segments using forward slashes. */
export function joinPaths(...segments) {
  return segments.join("/").replace(/\/+/g, "/");
}

/** Check if a URL/path points to an image. */
export function isImageUrl(url) {
  const base = url.split("?")[0].split("#")[0].toLowerCase();
  const imageExtensions = [
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
    ".bmp", ".avif", ".tif", ".tiff",
  ];
  return imageExtensions.some((ext) => base.endsWith(ext));
}

/** Compute a SHA-256 content hash of a Buffer or string. */
export function sha256(data) {
  const input = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Compute a short content-addressed name for an asset from URL + content hash. */
export function assetNameFromUrl(url, contentHash) {
  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname) || "image";
    const ext = path.extname(base) || ".bin";
    const name = base.replace(/\.[^.]*$/, "") || "image";
    return `${name}-${contentHash.slice(0, 12)}${ext}`;
  } catch {
    return `image-${contentHash.slice(0, 12)}.bin`;
  }
}

/** Resolve a reference URL against a base URL, returning null when impossible. */
export function resolveUrl(reference, baseUrl) {
  try {
    if (!reference) return null;
    const trimmed = reference.trim();
    if (!trimmed) return null;
    const resolved = new URL(trimmed, baseUrl);
    return resolved.toString();
  } catch {
    return null;
  }
}

/** Return true when a value looks like a data URI. */
export function isDataUri(value) {
  return /^data:([^;,]*;?)*/i.test(value);
}

/** Parse a data URI into { mime, charset, base64, data: Buffer }. Returns null on failure. */
export function parseDataUri(value) {
  const match = /^data:([^;,]*)(;charset=([^;]*))?(;base64)?,(.*)$/is.exec(value);
  if (!match) return null;
  const [, mime, , charset, base64, body] = match;
  const data = base64 ? Buffer.from(body, "base64") : Buffer.from(body, "utf8");
  return { mime, charset, base64: !!base64, data };
}

/** Truncate a string for display/logging. */
export function truncate(str, max = 120) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trim() + "\u2026";
}

/** Simple delay helper. */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Escape a string for safe insertion into JSON embedded in HTML. */
export function jsonEscapeForHtml(value) {
  return JSON.stringify(value)
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<!--/g, "<\\!--");
}

/** Sanitize a segment for use in a filesystem path component. */
export function sanitizePathSegment(segment) {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
