/**
 * Local asset store for generated images and their metadata sidecars.
 *
 * Writes are deterministic and side-effect free beyond creating files, so
 * tests can point OUTPUT_DIR at a temp directory.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export interface ImageAsset {
  id: string;
  filename: string;
  absolutePath: string;
  prompt: string;
  negativePrompt?: string;
  params: Record<string, unknown>;
  source: "lemonade";
  createdAt: string;
  sizeBytes: number;
  mimeType: string;
}

function ensureDir(dir: string) {
  return fs.mkdir(dir, { recursive: true });
}

function metaPathFor(imagePath: string): string {
  return `${imagePath}.meta.json`;
}

function slugify(text: string, maxLen = 40): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

function guessMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

/**
 * Persist raw image bytes + metadata to the output directory.
 */
export async function saveImageAsset(input: {
  prompt: string;
  negativePrompt?: string;
  params: Record<string, unknown>;
  buffer: Uint8Array;
  extension?: string;
  id?: string;
}): Promise<ImageAsset> {
  const dir = config.storage.outputDir;
  await ensureDir(dir);
  const id = input.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = slugify(input.prompt) || "image";
  const ext = (input.extension || "png").replace(/^\./, "");
  const filename = `${id}-${slug}.${ext}`;
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, input.buffer);

  const asset: ImageAsset = {
    id,
    filename,
    absolutePath,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    params: input.params,
    source: "lemonade",
    createdAt: new Date().toISOString(),
    sizeBytes: input.buffer.byteLength,
    mimeType: guessMime(filename),
  };

  await fs.writeFile(metaPathFor(absolutePath), JSON.stringify(asset, null, 2), "utf8");
  return asset;
}

/**
 * List the most recent generated assets (metadata sidecars only).
 */
export async function listRecentAssets(limit = 20): Promise<ImageAsset[]> {
  const dir = config.storage.outputDir;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const metas: ImageAsset[] = [];
  for (const name of entries) {
    if (!name.endsWith(".meta.json")) continue;
    const metaPath = path.join(dir, name);
    try {
      const raw = await fs.readFile(metaPath, "utf8");
      metas.push(JSON.parse(raw) as ImageAsset);
    } catch {
      // Skip corrupt/unreadable sidecars.
    }
  }
  return metas
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, Math.max(1, limit));
}