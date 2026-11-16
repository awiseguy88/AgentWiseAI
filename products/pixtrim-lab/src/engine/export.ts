import type { FilenamePattern, OutputFormat } from './settings';
import type { ImageLike } from './resize';
import { buildFilename } from './filename';

export interface ExportItem {
  canvas: HTMLCanvasElement;
  originalName: string;
  format: string;
  quality: number;
  pattern: FilenamePattern;
  customPattern?: string;
  index: number;
}

export interface ExportProgress {
  current: number;
  total: number;
}

export type ProgressCallback = (p: ExportProgress) => void;

function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
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

export function buildExportItem(
  canvas: HTMLCanvasElement,
  originalName: string,
  format: string,
  quality: number,
  pattern: FilenamePattern,
  customPattern: string | undefined,
  index: number
): ExportItem {
  return {
    canvas,
    originalName,
    format,
    quality,
    pattern,
    customPattern,
    index,
  };
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
    let name = buildFilename(item.pattern, item.originalName, item.index, item.format, item.customPattern);
    if (used.has(name)) {
      const ext = name.split('.').pop() || 'png';
      let n = 1;
      let candidate = `${name.replace(`.${ext}`, '')}_${n}.${ext}`;
      while (used.has(candidate)) {
        n += 1;
        candidate = `${name.replace(`.${ext}`, '')}_${n}.${ext}`;
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
  blob.then((b) => {
    const name = buildFilename(item.pattern, item.originalName, item.index, item.format, item.customPattern);
    triggerDownload(b, name);
  }).catch((e) => {
    console.error('Single file export failed', e);
  });
}
