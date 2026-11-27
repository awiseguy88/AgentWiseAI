import type { SourceImage, BackgroundMode } from './types';

export interface RasterOptions {
  background: BackgroundMode;
  flattenColor: string;
}

/**
 * Render a source image into a canvas of exactly `w` x `h` pixels.
 * The source is scaled to *cover* the target (preserving aspect ratio, centered),
 * matching how app icons are typically fitted. Transparency is preserved unless
 * `background === 'flatten'`, in which case the canvas is first filled with the
 * chosen color.
 */
export function renderToCanvas(src: SourceImage, w: number, h: number, opts: RasterOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');

  if (opts.background === 'flatten') {
    ctx.fillStyle = opts.flattenColor || '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const sw = src.drawWidth;
  const sh = src.drawHeight;
  // Cover fit: scale so the source fully covers the target, center-crop overflow.
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(src.drawable, dx, dy, dw, dh);
  return canvas;
}

/** Render at native scale (1:1 source pixels), top-left aligned, for the 1:1 toggle. */
export function renderNative(src: SourceImage, opts: RasterOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = src.drawWidth;
  canvas.height = src.drawHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  if (opts.background === 'flatten') {
    ctx.fillStyle = opts.flattenColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src.drawable, 0, 0, src.drawWidth, src.drawHeight);
  return canvas;
}