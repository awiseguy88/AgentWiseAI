import type { ResizeMode } from './settings';

export interface ResizeTarget {
  width: number;
  height: number;
  crop?: { sx: number; sy: number; sw: number; sh: number };
}

export interface ImageLike {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

export function computeTargetSize(
  record: { width: number; height: number },
  mode: ResizeMode,
  width: number,
  height: number,
  percentage: number = 100
): ResizeTarget {
  const srcW = record.width || 1;
  const srcH = record.height || 1;

  if (mode === 'percentage') {
    const pct = percentage > 0 ? percentage : 100;
    const scale = pct / 100;
    return {
      width: Math.max(1, Math.round(srcW * scale)),
      height: Math.max(1, Math.round(srcH * scale)),
    };
  }

  const reqW = width > 0 ? width : srcW;
  const reqH = height > 0 ? height : srcH;

  if (mode === 'exact') {
    return { width: Math.max(1, Math.round(reqW)), height: Math.max(1, Math.round(reqH)) };
  }

  if (mode === 'contain') {
    const scale = Math.min(reqW / srcW, reqH / srcH);
    return {
      width: Math.max(1, Math.round(srcW * scale)),
      height: Math.max(1, Math.round(srcH * scale)),
    };
  }

  if (mode === 'cover') {
    const scale = Math.max(reqW / srcW, reqH / srcH);
    const sw = reqW / scale;
    const sh = reqH / scale;
    const sx = Math.max(0, (srcW - sw) / 2);
    const sy = Math.max(0, (srcH - sh) / 2);
    return {
      width: Math.max(1, Math.round(reqW)),
      height: Math.max(1, Math.round(reqH)),
      crop: { sx, sy, sw, sh },
    };
  }

  return { width: Math.max(1, Math.round(reqW)), height: Math.max(1, Math.round(reqH)) };
}

export function renderResized(
  record: ImageLike,
  mode: ResizeMode,
  width: number,
  height: number,
  percentage: number = 100,
  cropOverride?: { sx: number; sy: number; sw: number; sh: number }
): HTMLCanvasElement {
  const t = computeTargetSize(record, mode, width, height, percentage);
  const out = document.createElement('canvas');
  out.width = t.width;
  out.height = t.height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const src = record.canvas;
  const crop = cropOverride || t.crop;

  if (mode === 'cover' && crop) {
    ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);
  } else {
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, out.width, out.height);
  }
  return out;
}

export function resizeToTarget(
  record: ImageLike,
  mode: ResizeMode,
  width: number,
  height: number,
  percentage: number = 100
): HTMLCanvasElement {
  return renderResized(record, mode, width, height, percentage);
}
