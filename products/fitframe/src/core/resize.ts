import type { CropMode, FocalPoint, CropRect } from '../types.ts';

export interface ResizeInput {
  srcW: number;
  srcH: number;
  targetW: number | null;
  targetH: number | null;
  lockAspect: boolean;
  cropMode: CropMode;
  focal: FocalPoint;
  customCrop?: CropRect | null;
}

export interface ResizePlan {
  outW: number;
  outH: number;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  destX: number;
  destY: number;
  destW: number;
  destH: number;
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

export function computeTargetSize(inW: number, inH: number, tw: number | null, th: number | null, lock: boolean): { w: number; h: number } {
  const ar = inW / inH || 1;
  let w = tw ?? 0;
  let h = th ?? 0;
  if (lock) {
    if (w > 0 && h > 0) {
      // fit target box preserving aspect by adjusting height to width
      h = Math.max(1, Math.round(w / ar));
    } else if (w > 0) {
      h = Math.max(1, Math.round(w / ar));
    } else if (h > 0) {
      w = Math.max(1, Math.round(h * ar));
    } else {
      w = inW; h = inH;
    }
  } else {
    if (w <= 0 && h <= 0) { w = inW; h = inH; }
    if (w <= 0) w = Math.max(1, Math.round(h * ar));
    if (h <= 0) h = Math.max(1, Math.round(w / ar));
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

export function computeResizePlan(input: ResizeInput): ResizePlan {
  const { srcW, srcH, cropMode, focal } = input;
  const { w: outW, h: outH } = computeTargetSize(srcW, srcH, input.targetW, input.targetH, input.lockAspect);

  if (cropMode === 'custom' && input.customCrop) {
    const c = input.customCrop;
    const sx = clamp(Math.round(c.x), 0, Math.max(0, srcW - 1));
    const sy = clamp(Math.round(c.y), 0, Math.max(0, srcH - 1));
    const sw = clamp(Math.round(c.w), 1, srcW - sx);
    const sh = clamp(Math.round(c.h), 1, srcH - sy);
    return { outW, outH, srcX: sx, srcY: sy, srcW: sw, srcH: sh, destX: 0, destY: 0, destW: outW, destH: outH };
  }

  const srcAr = srcW / srcH;
  const outAr = outW / outH;
  const fx = clamp(focal?.x ?? 0.5, 0, 1);
  const fy = clamp(focal?.y ?? 0.5, 0, 1);

  if (cropMode === 'cover') {
    let sw: number, sh: number;
    if (srcAr > outAr) {
      sh = srcH;
      sw = Math.round(sh * outAr);
    } else {
      sw = srcW;
      sh = Math.round(sw / outAr);
    }
    sw = clamp(sw, 1, srcW);
    sh = clamp(sh, 1, srcH);
    const sx = clamp(Math.round(fx * srcW - sw / 2), 0, srcW - sw);
    const sy = clamp(Math.round(fy * srcH - sh / 2), 0, srcH - sh);
    return { outW, outH, srcX: sx, srcY: sy, srcW: sw, srcH: sh, destX: 0, destY: 0, destW: outW, destH: outH };
  }

  // contain
  let dw: number, dh: number;
  if (srcAr > outAr) {
    dw = outW;
    dh = Math.round(outW / srcAr);
  } else {
    dh = outH;
    dw = Math.round(outH * srcAr);
  }
  dw = clamp(dw, 1, outW);
  dh = clamp(dh, 1, outH);
  const dx = Math.round((outW - dw) / 2);
  const dy = Math.round((outH - dh) / 2);
  return { outW, outH, srcX: 0, srcY: 0, srcW, srcH, destX: dx, destY: dy, destW: dw, destH: dh };
}

export function suggestFocalPoint(_w: number, _h: number): FocalPoint {
  // Lightweight deterministic "smart" default: center-bias (safe auto-detect fallback).
  // Manual adjustment is available per image for precise control.
  return { x: 0.5, y: 0.45 };
}
