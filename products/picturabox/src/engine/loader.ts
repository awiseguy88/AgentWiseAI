import type { ImageRecord } from './types';
import { findOrientationTag, orientationToTransform } from './exif';

const ACCEPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp', 'image/gif', 'image/tiff', 'image/svg+xml']);
const ACCEPT_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'gif', 'tiff', 'tif', 'svg']);

function isAccepted(file: File): boolean {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return ACCEPT_TYPES.has(file.type) || ACCEPT_EXT.has(ext);
}

export function acceptFile(file: File): boolean {
  return isAccepted(file);
}

function applyOrientationTransform(c: HTMLCanvasElement, o: number | null): HTMLCanvasElement {
  if (!o || o === 1) return c;
  const t = orientationToTransform(o);
  const w = c.width;
  const h = c.height;
  const out = document.createElement('canvas');
  out.width = t.swap ? h : w;
  out.height = t.swap ? w : h;
  const ctx = out.getContext('2d')!;
  ctx.save();
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((t.rotateDeg * Math.PI) / 180);
  if (t.flipX) ctx.scale(-1, 1);
  if (t.flipY) ctx.scale(1, -1);
  ctx.drawImage(c, -w / 2, -h / 2);
  ctx.restore();
  return out;
}

async function rasterizeSvg(file: File): Promise<HTMLCanvasElement> {
  const text = await file.text();
  const blob = new Blob([text], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadToCanvas(file: File): Promise<HTMLCanvasElement> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'svg') {
    return rasterizeSvg(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageFile(file: File): Promise<ImageRecord> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (!isAccepted(file)) {
    return {
      id, file, name: file.name, originalName: file.name, type: file.type, size: file.size,
      width: 0, height: 0, orientation: null, canvas: document.createElement('canvas'),
      dataUrl: '', error: `Unsupported file type: ${file.type || file.name}`,
    };
  }
  try {
    const rawCanvas = await loadToCanvas(file);
    let orientation: number | null = null;
    if (file.type === 'image/jpeg' || /jpe?g/i.test(file.name)) {
      orientation = findOrientationTag(await file.arrayBuffer());
    }
    const canvas = applyOrientationTransform(rawCanvas, orientation);
    const dataUrl = canvas.toDataURL('image/png');
    return {
      id, file, name: file.name, originalName: file.name, type: file.type, size: file.size,
      width: canvas.width, height: canvas.height, orientation, canvas, dataUrl,
    };
  } catch (e: any) {
    return {
      id, file, name: file.name, originalName: file.name, type: file.type, size: file.size,
      width: 0, height: 0, orientation: null, canvas: document.createElement('canvas'),
      dataUrl: '', error: `Could not read ${file.name}: ${e?.message || 'unknown error'}`,
    };
  }
}

export async function loadImageFiles(files: File[]): Promise<ImageRecord[]> {
  return Promise.all(files.map(loadImageFile));
}