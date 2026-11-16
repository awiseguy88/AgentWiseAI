import JSZip from 'jszip';
import type { ProcessResult } from '../types.ts';

export async function exportZip(results: ProcessResult[], zipName = 'fitframe-export.zip'): Promise<void> {
  const zip = new JSZip();
  for (const r of results) {
    if (r.ok && r.blob && r.name) zip.file(r.name, r.blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, zipName);
}

export function exportIndividual(results: ProcessResult[]): void {
  for (const r of results) {
    if (r.ok && r.blob && r.name) downloadBlob(r.blob, r.name);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveToFolder(results: ProcessResult[]): Promise<{ ok: boolean; fallback?: boolean; message?: string }> {
  const okResults = results.filter((r) => r.ok && r.blob && r.name);
  if (!okResults.length) return { ok: false, message: 'No files to save' };
  const anyWin = window as any;
  if (typeof anyWin.showDirectoryPicker === 'function') {
    try {
      const dir = await anyWin.showDirectoryPicker();
      for (const r of okResults) {
        const fh = await dir.getFileHandle(r.name!, { create: true });
        const writable = await fh.createWritable();
        await writable.write(r.blob!);
        await writable.close();
      }
      return { ok: true };
    } catch (e: any) {
      if (e?.name === 'AbortError') return { ok: false, message: 'Save cancelled' };
      // fall through to fallback
    }
  }
  // graceful fallback
  await exportZip(results);
  return { ok: true, fallback: true, message: 'Folder access unavailable; downloaded ZIP instead.' };
}