import type { SizeSpec } from './types';

export const MIN_SIZE = 16;
export const MAX_SIZE = 256;

/** Preset square sizes offered as toggle chips. */
export const PRESET_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;

/** Maximum accepted source file size (bytes) — 32 MB. */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

/** Accepted input MIME types. GIF uses the first frame; SVG is rasterized. */
export const SUPPORTED_TYPES = [
  'image/png',
  'image/svg+xml',
  'image/jpeg',
  'image/jpg',
  'image/bmp',
  'image/x-ms-bmp',
  'image/gif',
  'image/webp',
] as const;

const EXT_MAP: Record<string, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  bmp: 'image/bmp',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Resolve a File's declared type, falling back to its extension. */
export function resolveType(file: { type: string; name: string }): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXT_MAP[ext] || '';
}

export function isSupportedType(type: string): boolean {
  return (SUPPORTED_TYPES as readonly string[]).includes(type.toLowerCase());
}

export function clampSize(n: number): number {
  if (Number.isNaN(n)) return MIN_SIZE;
  return Math.min(Math.max(Math.trunc(n), MIN_SIZE), MAX_SIZE);
}

export interface ParseResult {
  sizes: SizeSpec[];
  errors: string[];
  clamped: boolean;
}

/**
 * Parse a custom size list of `[W]x[H]` tokens separated by commas.
 * Each token is clamped to the 16–256 range. Bare `N` is treated as `NxN`.
 * Invalid tokens produce an error string and are skipped.
 */
export function parseCustomSizes(input: string): ParseResult {
  const sizes: SizeSpec[] = [];
  const errors: string[] = [];
  let clamped = false;
  const tokens = input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return { sizes, errors: ['Enter at least one size, e.g. 32x32 or 64x64,128x128.'], clamped };
  }
  for (const tok of tokens) {
    const m = /^(\d+)(?:x(\d+))?$/i.exec(tok);
    if (!m) {
      errors.push(`"${tok}" is not a valid size — use [W]x[H] like 32x32.`);
      continue;
    }
    const rawW = parseInt(m[1], 10);
    const rawH = m[2] ? parseInt(m[2], 10) : rawW;
    if (Number.isNaN(rawW) || Number.isNaN(rawH) || rawW <= 0 || rawH <= 0) {
      errors.push(`"${tok}" has a non-positive dimension.`);
      continue;
    }
    const w = clampSize(rawW);
    const h = clampSize(rawH);
    if (w !== rawW || h !== rawH) clamped = true;
    sizes.push({ w, h });
  }
  return { sizes, errors, clamped };
}

/** Build the de-duplicated list of sizes to render from presets + custom. */
export function mergeSizes(presetValues: number[], custom: SizeSpec[]): SizeSpec[] {
  const seen = new Set<string>();
  const out: SizeSpec[] = [];
  for (const n of presetValues) {
    const key = `${n}x${n}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ w: n, h: n });
    }
  }
  for (const s of custom) {
    const key = `${s.w}x${s.h}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ w: s.w, h: s.h });
    }
  }
  out.sort((a, b) => a.w * a.h - b.w * b.h || a.w - b.w);
  return out;
}

export function sizeKey(s: SizeSpec): string {
  return `${s.w}x${s.h}`;
}

export function clampDimensionToByte(n: number): number {
  // ICO stores 0 to mean 256.
  return n >= 256 ? 0 : n;
}