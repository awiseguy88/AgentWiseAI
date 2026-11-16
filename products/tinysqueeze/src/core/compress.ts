import type { ImageItem } from '../types.ts';
import { clampQuality, isJpegType, compressedName, COMPRESSED_SUFFIX } from '../constants.ts';
import { computeSavingsPercent } from './format.ts';

/** Load an image File into an Image element so we can read its dimensions. */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to decode image'));
    img.src = URL.createObjectURL(file);
  });
}

/** Convert a canvas to a Blob for the target type/quality. */
async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  if (typeof (canvas as HTMLCanvasElement).toBlob === 'function') {
    return new Promise((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
        mimeType,
        quality,
      );
    });
  }
  if (typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    const blob = await (canvas as OffscreenCanvas).convertToBlob({
      type: mimeType,
      quality,
    });
    if (blob) return blob;
    throw new Error('Canvas encoding failed');
  }
  throw new Error('Canvas toBlob is not available in this environment');
}

/**
 * Compress a single image file client-side.
 * JPEG: lossy quality encoding (1-100). PNG: canvas re-encode (quality label is informational).
 */
export async function compressImage(
  file: File,
  quality: number,
): Promise<{ blob: Blob; name: string; size: number }> {
  const img = await loadImage(file);
  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error('Unable to decode image dimensions');
  }

  const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create canvas context');
  ctx.drawImage(img, 0, 0);

  const q = clampQuality(quality) / 100;
  const isJpeg = isJpegType(file.type);
  const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
  const blob = await canvasToBlob(canvas, mimeType, q);
  const ext = isJpeg ? 'jpg' : 'png';
  return { blob, name: compressedName(file.name, ext), size: blob.size };
}

/**
 * Concurrency-limited batch compression. One item's failure never blocks the others.
 */
export async function compressItems(
  items: Array<{ file: File; quality: number }>,
  onProgress: (index: number, result: { ok: boolean; error?: string }) => void,
  concurrency = 3,
): Promise<Array<{ ok: boolean; error?: string; blob?: Blob; name?: string; size?: number }>> {
  const results: Array<{ ok: boolean; error?: string; blob?: Blob; name?: string; size?: number }> =
    items.map(() => ({ ok: false }));
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async (_, workerId) => {
    let index = workerId;
    while (index < items.length) {
      try {
        const { blob, name, size } = await compressImage(items[index].file, items[index].quality);
        results[index] = { ok: true, blob, name, size };
      } catch (err) {
        results[index] = { ok: false, error: err instanceof Error ? err.message : 'Compression failed' };
      } finally {
        onProgress(index, results[index] as { ok: boolean; error?: string });
        index += concurrency;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/** Build download filename for an item given its original name and MIME type. */
export function itemCompressedName(item: Pick<ImageItem, 'name' | 'type'>): string {
  return compressedName(item.name, isJpegType(item.type) ? 'jpg' : 'png');
}