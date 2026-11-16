import type { OutputFormat } from './types';

export interface ExportItem {
  canvas: HTMLCanvasElement;
  originalName: string;
  format: OutputFormat;
  quality: number;
  pattern: string;
  customName?: string;
  index: number;
}

export interface ExportProgress {
  current: number;
  total: number;
}

export type ProgressCallback = (p: ExportProgress) => void;

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mime = format === 'jpeg' ? 'image/jpeg'
      : format === 'webp' ? 'image/webp'
      : format === 'png' ? 'image/png'
      : format === 'avif' ? 'image/avif'
      : 'image/png';
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(`Canvas toBlob failed for ${mime}`));
    }, mime, quality / 100);
  });
}

export async function exportSingleFile(item: ExportItem): Promise<Blob> {
  return canvasToBlob(item.canvas, item.format, item.quality);
}

export async function exportZip(
  items: ExportItem[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const used = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const blob = await exportSingleFile(item);
    const baseName = `pictura_${String(item.index).padStart(3, '0')}`;
    let name = `${baseName}.${item.format === 'original' ? 'png' : item.format === 'jpeg' ? 'jpg' : item.format}`;
    if (used.has(name)) {
      const ext = name.split('.').pop() || 'png';
      let n = 1;
      let candidate = `${baseName}_${n}.${ext}`;
      while (used.has(candidate)) {
        n += 1;
        candidate = `${baseName}_${n}.${ext}`;
      }
      name = candidate;
    }
    used.add(name);
    zip.file(name, blob);
    onProgress?.({ current: i + 1, total: items.length });
  }
  return zip.generateAsync({ type: 'blob' });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadSingleFile(item: ExportItem): void {
  const blob = exportSingleFile(item);
  const name = `${item.originalName.replace(/\.[^.]+$/, '')}.${item.format === 'original' ? 'png' : item.format === 'jpeg' ? 'jpg' : item.format}`;
  blob.then((b) => triggerDownload(b, name)).catch((e) => console.error('Single file export failed', e));
}