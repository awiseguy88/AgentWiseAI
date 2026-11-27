import type { SourceImage, GenerateSettings, GeneratedAsset, SizeSpec } from './types';
import { renderToCanvas } from './raster';
import { canvasToPngBytes } from './png';
import { encodeIco } from './ico';
import { sizeKey } from './sizes';

export function assetBaseName(srcName: string): string {
  const stem = srcName.replace(/\.[^.]+$/, '') || 'icon';
  return stem.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'icon';
}

export function perSizeFileName(base: string, s: SizeSpec): string {
  return `${base}-${s.w}x${s.h}.png`;
}

/** Rasterize every requested size to PNG bytes. */
export async function renderSizeAssets(src: SourceImage, settings: GenerateSettings): Promise<Array<{ size: SizeSpec; png: Uint8Array }>> {
  const out: Array<{ size: SizeSpec; png: Uint8Array }> = [];
  for (const size of settings.sizes) {
    const canvas = renderToCanvas(src, size.w, size.h, {
      background: settings.background,
      flattenColor: settings.flattenColor,
    });
    const png = await canvasToPngBytes(canvas);
    out.push({ size, png });
  }
  return out;
}

/**
 * Build the full set of generated assets for the current source + settings.
 * - multi mode: a single multi-resolution favicon.ico plus per-size PNGs (for preview/download)
 * - per-size mode: only per-size PNGs
 */
export async function buildAssets(src: SourceImage, settings: GenerateSettings): Promise<GeneratedAsset[]> {
  const base = assetBaseName(src.name);
  const rendered = await renderSizeAssets(src, settings);
  const assets: GeneratedAsset[] = [];

  if (settings.iconType === 'multi') {
    const frames = rendered.map((r) => ({ width: r.size.w, height: r.size.h, png: r.png }));
    const ico = encodeIco(frames);
    assets.push({ name: 'favicon.ico', role: 'favicon-ico', width: 0, height: 0, bytes: ico, mime: 'image/x-icon' });
  }

  for (const r of rendered) {
    assets.push({
      name: perSizeFileName(base, r.size),
      role: 'png',
      width: r.size.w,
      height: r.size.h,
      bytes: r.png,
      mime: 'image/png',
    });
  }

  return assets;
}

/** Build a single-size PNG asset (used for individual asset download of arbitrary sizes). */
export async function buildSinglePng(src: SourceImage, settings: GenerateSettings, size: SizeSpec): Promise<GeneratedAsset> {
  const canvas = renderToCanvas(src, size.w, size.h, {
    background: settings.background,
    flattenColor: settings.flattenColor,
  });
  const png = await canvasToPngBytes(canvas);
  return {
    name: perSizeFileName(assetBaseName(src.name), size),
    role: 'png',
    width: size.w,
    height: size.h,
    bytes: png,
    mime: 'image/png',
  };
}

export { sizeKey };