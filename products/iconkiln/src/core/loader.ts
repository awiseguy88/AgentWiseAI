import type { SourceImage } from './types';
import { MAX_FILE_BYTES, resolveType, isSupportedType } from './sizes';

export type LoadErrorKind = 'unsupported' | 'oversized' | 'decode';

export class SourceLoadError extends Error {
  kind: LoadErrorKind;
  constructor(kind: LoadErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'SourceLoadError';
  }
}

/** Validate a candidate file's type and size before any decoding. */
export function validateFile(file: { type: string; name: string; size: number }): string {
  const type = resolveType(file);
  if (!isSupportedType(type)) {
    return `"${file.name}" is not a supported image. Use PNG, SVG, JPG, BMP, GIF, or WebP.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const max = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(0);
    return `"${file.name}" is too large (${mb} MB). The limit is ${max} MB.`;
  }
  return '';
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode-failed'));
    img.src = url;
  });
}

/** Rasterize an SVG source string to a canvas at its intrinsic size (bounded). */
async function rasterizeSvg(file: File, objectUrl: string): Promise<{ drawable: CanvasImageSource; w: number; h: number }> {
  const img = await loadHtmlImage(objectUrl);
  // SVG intrinsic size may be 0 if only viewBox is set; fall back to a sane default.
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) {
    w = 512;
    h = 512;
  }
  // Bound extremely large rasterizations to keep memory reasonable.
  const maxDim = 4096;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  ctx.drawImage(img, 0, 0, cw, ch);
  void file;
  return { drawable: canvas, w: cw, h: ch };
}

/**
 * Load and decode a source image File into a drawable SourceImage.
 * Throws SourceLoadError for unsupported, oversized, or undecodable inputs.
 */
export async function loadSourceImage(file: File): Promise<SourceImage> {
  const problem = validateFile(file);
  if (problem) {
    const kind: LoadErrorKind = resolveType(file) && !isSupportedType(resolveType(file)) ? 'unsupported' : 'oversized';
    throw new SourceLoadError(kind, problem);
  }
  const type = resolveType(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    if (type === 'image/svg+xml') {
      const { drawable, w, h } = await rasterizeSvg(file, objectUrl);
      return {
        name: file.name,
        type,
        bytes: file.size,
        width: w,
        height: h,
        drawable,
        drawWidth: w,
        drawHeight: h,
        objectUrl,
      };
    }
    const img = await loadHtmlImage(objectUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new SourceLoadError('decode', `"${file.name}" could not be decoded.`);
    return {
      name: file.name,
      type,
      bytes: file.size,
      width: w,
      height: h,
      drawable: img,
      drawWidth: w,
      drawHeight: h,
      objectUrl,
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    if (err instanceof SourceLoadError) throw err;
    throw new SourceLoadError('decode', `"${file.name}" could not be decoded as an image.`);
  }
}

export function releaseSource(src: SourceImage | null): void {
  if (src?.objectUrl) {
    URL.revokeObjectURL(src.objectUrl);
    src.objectUrl = undefined;
  }
}