import type { CropRect } from './types';

export function clampCrop(rect: CropRect, imgW: number, imgH: number): CropRect {
  const w = Math.max(1, Math.min(rect.w, imgW));
  const h = Math.max(1, Math.min(rect.h, imgH));
  const x = Math.max(0, Math.min(rect.x, imgW - w));
  const y = Math.max(0, Math.min(rect.y, imgH - h));
  return { x, y, w, h };
}

export function applyCrop(canvas: HTMLCanvasElement, rect: CropRect): HTMLCanvasElement {
  const c = clampCrop(rect, canvas.width, canvas.height);
  const out = document.createElement('canvas');
  out.width = Math.round(c.w);
  out.height = Math.round(c.h);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);
  return out;
}

export function cropRectFromDrag(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  imgW: number,
  imgH: number
): CropRect {
  const x = Math.max(0, Math.min(startX, currentX));
  const y = Math.max(0, Math.min(startY, currentY));
  const w = Math.min(imgW - x, Math.abs(currentX - startX));
  const h = Math.min(imgH - y, Math.abs(currentY - startY));
  return clampCrop({ x, y, w: Math.max(1, w), h: Math.max(1, h) }, imgW, imgH);
}