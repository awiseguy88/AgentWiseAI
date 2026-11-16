import type { WatermarkSettings } from '../types.ts';

export interface PositionInfo { x: number; y: number; align: 'left' | 'center' | 'right'; baseline: 'top' | 'middle' | 'bottom' | 'alphabetic'; }

export function positionToOffsets(position: WatermarkSettings['position'], outW: number, outH: number, markW: number, markH: number, pad = 0.05): { x: number; y: number; align: PositionInfo['align']; baseline: PositionInfo['baseline'] } {
  const px = Math.round(outW * pad);
  const py = Math.round(outH * pad);
  switch (position) {
    case 'top-left': return { x: px, y: py, align: 'left', baseline: 'top' };
    case 'top-center': return { x: outW / 2, y: py, align: 'center', baseline: 'top' };
    case 'top-right': return { x: outW - px, y: py, align: 'right', baseline: 'top' };
    case 'middle-left': return { x: px, y: outH / 2, align: 'left', baseline: 'middle' };
    case 'middle-center': return { x: outW / 2, y: outH / 2, align: 'center', baseline: 'middle' };
    case 'middle-right': return { x: outW - px, y: outH / 2, align: 'right', baseline: 'middle' };
    case 'bottom-left': return { x: px, y: outH - py, align: 'left', baseline: 'bottom' };
    case 'bottom-center': return { x: outW / 2, y: outH - py, align: 'center', baseline: 'bottom' };
    case 'bottom-right':
    default:
      return { x: outW - px, y: outH - py, align: 'right', baseline: 'bottom' };
  }
}

export function drawTextWatermark(ctx: CanvasRenderingContext2D, outW: number, outH: number, wm: WatermarkSettings): void {
  if (!wm.enabled || !wm.text.trim()) return;
  const pos = positionToOffsets(wm.position, outW, outH, 0, 0);
  ctx.save();
  ctx.font = `${wm.size}px ${wm.font}`;
  ctx.fillStyle = wm.color;
  ctx.globalAlpha = Math.max(0, Math.min(1, wm.opacity));
  ctx.textAlign = pos.align;
  ctx.textBaseline = pos.baseline;
  if (wm.angle) {
    ctx.translate(pos.x, pos.y);
    ctx.rotate((wm.angle * Math.PI) / 180);
    ctx.fillText(wm.text, 0, 0);
  } else {
    ctx.fillText(wm.text, pos.x, pos.y);
  }
  ctx.restore();
}

export function drawImageWatermark(ctx: CanvasRenderingContext2D, outW: number, outH: number, wm: WatermarkSettings, image: CanvasImageSource, imgW: number, imgH: number): void {
  if (!wm.enabled || !wm.imageDataUrl) return;
  const scale = Math.max(0, Math.min(1, wm.imageScale));
  if (scale <= 0 || imgW <= 0 || imgH <= 0) return;
  const drawW = Math.max(1, Math.round(outW * scale));
  const drawH = Math.max(1, Math.round(drawW * (imgH / imgW)));
  const pos = positionToOffsets(wm.position, outW, outH, drawW, drawH);
  const left = pos.align === 'right' ? pos.x - drawW : pos.align === 'center' ? pos.x - drawW / 2 : pos.x;
  const top = pos.baseline === 'bottom' ? pos.y - drawH : pos.baseline === 'middle' ? pos.y - drawH / 2 : pos.y;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, wm.opacity));
  ctx.drawImage(image, left, top, drawW, drawH);
  ctx.restore();
}

export function drawBorder(ctx: CanvasRenderingContext2D, outW: number, outH: number, color: string, thickness: number): void {
  if (thickness <= 0) return;
  const t = Math.round(thickness);
  const half = t / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = t;
  ctx.strokeRect(half, half, Math.max(0, outW - t), Math.max(0, outH - t));
  ctx.restore();
}