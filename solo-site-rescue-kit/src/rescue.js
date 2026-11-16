/**
 * Solo Site Rescue Kit — image rescue.
 *
 * Downloads remote images into a local `assets/images/` folder with a content-addressed
 * cache (`.rescue-cache/`). Supports offline mode (cache-only), retries, timeouts, and
 * bounded concurrency. No external dependencies; uses global fetch (Node >= 18).
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { sha256, assetNameFromUrl, isDataUri, delay, ensureDir } from "./utils.js";

/** Summary of the rescue run. */
export class RescueSummary {
  constructor() {
    this.attempted = 0;
    this.succeeded = 0;
    this.cached = 0;
    this.skipped = 0;
    this.failed = 0;
    this.dataUri = 0;
    this.local = 0;
    this.entries = []; // per-asset detail
  }
}

function cacheKeyForUrl(url) {
  return sha256(url);
}

/**
 * Attempt to fetch a remote URL. Returns { ok, buffer, contentType, error }.
 */
async function fetchImage(url, { timeoutMs, signal }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Solo-Site-Rescue-Kit/1.0" },
    });
    if (!res.ok) {
      return { ok: false, buffer: null, contentType: null, error: `HTTP ${res.status}` };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { ok: true, buffer, contentType: res.headers.get("content-type"), error: null };
  } catch (err) {
    if (err.name === "AbortError") {
      return { ok: false, buffer: null, contentType: null, error: "timeout" };
    }
    return { ok: false, buffer: null, contentType: null, error: err.message || String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Read a cached file if it exists. Cache layout:
 *   <cacheDir>/<hash>.bin + <cacheDir>/<hash>.meta.json
 */
async function readCache(cacheDir, url) {
  const key = cacheKeyForUrl(url);
  const binPath = path.join(cacheDir, `${key}.bin`);
  const metaPath = path.join(cacheDir, `${key}.meta.json`);
  try {
    const [buffer, metaRaw] = await Promise.all([fsp.readFile(binPath), fsp.readFile(metaPath)]);
    const meta = JSON.parse(metaRaw.toString("utf8"));
    return { buffer, meta, hit: true, key };
  } catch {
    return { buffer: null, meta: null, hit: false, key };
  }
}

/** Write a buffer + metadata to the cache. */
async function writeCache(cacheDir, url, buffer, contentType) {
  const key = cacheKeyForUrl(url);
  await ensureDir(cacheDir);
  const binPath = path.join(cacheDir, `${key}.bin`);
  const metaPath = path.join(cacheDir, `${key}.meta.json`);
  const meta = { url, contentType, size: buffer.length, hash: sha256(buffer), cachedAt: new Date().toISOString() };
  await Promise.all([fsp.writeFile(binPath, buffer), fsp.writeFile(metaPath, JSON.stringify(meta, null, 2))]);
  return { key, meta, path: binPath };
}

/**
 * Determine if a URL can be considered "remote" for rescue purposes.
 */
export function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url);
}

/**
 * Rescue a single image reference.
 * Options: { outDir, cacheDir, offline, timeoutMs, retries, concurrency }
 */
export async function rescueImage(ref, options) {
  const { outDir, cacheDir, offline, timeoutMs, retries } = options;
  const result = { url: ref.url, status: "skipped", localPath: null, reason: null, cacheHit: false, size: 0 };

  // Data URIs are preserved inline.
  if (isDataUri(ref.url)) {
    result.status = "data-uri";
    result.reason = "inline data URI preserved";
    return result;
  }

  // Local files (not remote) are not "rescued" from the network.
  if (!isRemoteUrl(ref.url)) {
    result.status = "local-ref";
    result.reason = "local/relative reference";
    result.localPath = ref.url;
    return result;
  }

  result.status = "pending";

  // 1. Check cache first (offline-friendly).
  const cached = await readCache(cacheDir, ref.url);
  if (cached.hit) {
    result.status = "rescued";
    result.cacheHit = true;
    result.size = cached.buffer.length;
    const fileName = assetNameFromUrl(ref.url, sha256(cached.buffer));
    const destPath = path.join(outDir, "assets", "images", fileName);
    await ensureDir(path.dirname(destPath));
    await fsp.writeFile(destPath, cached.buffer);
    result.localPath = path.relative(outDir, destPath).split(path.sep).join("/");
    result.reason = "served from cache";
    return result;
  }

  // 2. Offline mode: cannot fetch.
  if (offline) {
    result.status = "failed";
    result.reason = "offline: no cache entry";
    return result;
  }

  // 3. Attempt network fetch with retries.
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await delay(250 * attempt);
    const fetched = await fetchImage(ref.url, { timeoutMs });
    if (fetched.ok) {
      const hash = sha256(fetched.buffer);
      await writeCache(cacheDir, ref.url, fetched.buffer, fetched.contentType);
      const fileName = assetNameFromUrl(ref.url, hash);
      const destPath = path.join(outDir, "assets", "images", fileName);
      await ensureDir(path.dirname(destPath));
      await fsp.writeFile(destPath, fetched.buffer);
      result.status = "rescued";
      result.size = fetched.buffer.length;
      result.localPath = path.relative(outDir, destPath).split(path.sep).join("/");
      result.reason = attempt > 0 ? `rescued after ${attempt} retries` : "rescued";
      return result;
    }
    lastError = fetched.error;
  }

  result.status = "failed";
  result.reason = lastError || "unknown fetch error";
  return result;
}

/**
 * Rescue all image references in an extraction with bounded concurrency.
 * Mutates ref.status / ref.localPath and returns a RescueSummary.
 */
export async function rescueImages(extraction, options) {
  const {
    outDir,
    cacheDir = path.join(outDir, ".rescue-cache"),
    offline = false,
    timeoutMs = 8000,
    retries = 1,
    concurrency = 4,
  } = options;

  const summary = new RescueSummary();
  const refs = extraction.images;
  const results = new Array(refs.length);
  let index = 0;

  const worker = async () => {
    while (index < refs.length) {
      const i = index++;
      const ref = refs[i];
      try {
        const res = await rescueImage(ref, { outDir, cacheDir, offline, timeoutMs, retries });
        results[i] = res;
        ref.status = res.status === "rescued" ? "rescued" : res.status === "data-uri" ? "data-uri" : res.status === "local-ref" ? "local" : "missing";
        if (res.localPath) ref.localPath = res.localPath;
        // Tally.
        summary.attempted++;
        if (res.status === "rescued") { summary.succeeded++; if (res.cacheHit) summary.cached++; }
        else if (res.status === "data-uri") summary.dataUri++;
        else if (res.status === "local-ref") summary.local++;
        else if (res.status === "failed") summary.failed++;
        else summary.skipped++;
        summary.entries.push(res);
      } catch (err) {
        results[i] = { url: ref.url, status: "failed", reason: err.message };
        ref.status = "missing";
        summary.attempted++;
        summary.failed++;
        summary.entries.push(results[i]);
      }
    }
  };

  const workers = [];
  const count = Math.max(1, Math.min(concurrency, refs.length || 1));
  for (let w = 0; w < count; w++) workers.push(worker());
  await Promise.all(workers);

  return summary;
}
