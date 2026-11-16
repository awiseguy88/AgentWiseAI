import type { ImageItem, OutputFormat, ProcessResult, Settings } from '../types.ts';
import { computeResizePlan } from './resize.ts';
import { drawBorder, drawImageWatermark, drawTextWatermark } from './watermark.ts';
import { applyRenamePattern, splitName } from './rename.ts';

export interface LoadResult { item: Omit<ImageItem, 'id' | 'status' | 'progress'>; }

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function getCtx(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

async function toBlob(canvas: HTMLCanvasElement | OffscreenCanvas, mime: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((b) => b ? resolve(b) : reject(new Error(`Failed to encode ${mime}`)), mime, quality);
  });
}

export async function loadImageFile(file: File, index: number): Promise<LoadResult> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { base } = splitName(file.name);
    return {
      item: {
        file,
        name: file.name,
        originalName: base,
        size: file.size,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        thumbUrl: url,
        focal: { x: 0.5, y: 0.45 },
        customCrop: null,
      },
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unsupported or corrupt image'));
    img.src = url;
  });
}

export function resolveOutputMime(format: OutputFormat, originalType: string, caps: { avif: boolean; webp: boolean; jpeg: boolean }): { mime: string; ext: string } {
  const orig = (originalType || '').toLowerCase();
  const pick = (f: OutputFormat): { mime: string; ext: string } => {
    if (f === 'jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
    if (f === 'webp') return caps.webp ? { mime: 'image/webp', ext: 'webp' } : { mime: 'image/jpeg', ext: 'jpg' };
    if (f === 'avif') return caps.avif ? { mime: 'image/avif', ext: 'avif' } : caps.webp ? { mime: 'image/webp', ext: 'webp' } : { mime: 'image/jpeg', ext: 'jpg' };
    // original
    if (orig === 'image/png') return { mime: 'image/png', ext: 'png' };
    if (orig === 'image/webp') return { mime: 'image/webp', ext: 'webp' };
    if (orig === 'image/avif') return caps.avif ? { mime: 'image/avif', ext: 'avif' } : { mime: 'image/jpeg', ext: 'jpg' };
    return { mime: 'image/jpeg', ext: 'jpg' };
  };
  return pick(format);
}

export async function processImage(item: ImageItem, index: number, settings: Settings, caps: { avif: boolean; webp: boolean; jpeg: boolean }): Promise<ProcessResult> {
  try {
    const img = await loadImage(item.thumbUrl || URL.createObjectURL(item.file));
    const plan = computeResizePlan({
      srcW: img.naturalWidth || item.width,
      srcH: img.naturalHeight || item.height,
      targetW: settings.targetWidth,
      targetH: settings.targetHeight,
      lockAspect: settings.lockAspect,
      cropMode: settings.cropMode,
      focal: item.focal || { x: 0.5, y: 0.5 },
      customCrop: item.customCrop ?? null,
    });
    const scale = settings.ai.upscale && settings.ai.upscale > 1 ? settings.ai.upscale : 1;
    const outW = Math.max(1, Math.round(plan.outW * scale));
    const outH = Math.max(1, Math.round(plan.outH * scale));
    const canvas = makeCanvas(outW, outH);
    const ctx = getCtx(canvas);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = settings.highQualityResize ? 'high' : 'medium';

    // contain background transparent/white as needed
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(
      img,
      plan.srcX, plan.srcY, plan.srcW, plan.srcH,
      Math.round(plan.destX * scale), Math.round(plan.destY * scale),
      Math.round(plan.destW * scale), Math.round(plan.destH * scale)
    );

    // image watermark (if any)
    if (settings.watermark.enabled && settings.watermark.imageDataUrl) {
      try {
        const wmImg = await loadImage(settings.watermark.imageDataUrl);
        drawImageWatermark(ctx as CanvasRenderingContext2D, outW, outH, settings.watermark, wmImg, wmImg.naturalWidth, wmImg.naturalHeight);
      } catch { /* graceful */ }
    }
    // text watermark
    drawTextWatermark(ctx as CanvasRenderingContext2D, outW, outH, settings.watermark);
    // border
    if (settings.border.enabled) drawBorder(ctx as CanvasRenderingContext2D, outW, outH, settings.border.color, settings.border.thickness);

    const { mime, ext } = resolveOutputMime(settings.outputFormat, item.file.type, caps);
    const q = mime === 'image/png' ? undefined : Math.max(0, Math.min(1, settings.quality / 100));
    const blob = await toBlob(canvas, mime, q ?? 0.92);
    const name = applyRenamePattern({ pattern: settings.renamePattern, start: settings.renameStart, index, originalName: item.originalName, ext });
    return { id: item.id, ok: true, blob, name };
  } catch (e: any) {
    return { id: item.id, ok: false, error: e?.message || String(e) };
  }
}

export async function processBatch(
  items: ImageItem[],
  settings: Settings,
  caps: { avif: boolean; webp: boolean; jpeg: boolean },
  onProgress: (id: string, p: number, overall: number) => void
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress(item.id, 0.1, i / items.length);
    const res = await processImage(item, i, settings, caps);
    results.push(res);
    onProgress(item.id, 1, (i + 1) / items.length);
    // yield to keep UI responsive
    await new Promise((r) => setTimeout(r, 0));
  }
  return results;
}