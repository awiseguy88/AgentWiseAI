import JSZip from 'jszip';

/** Add multiple blobs to a zip and trigger download. */
export async function downloadAllAsZip(
  items: Array<{ name: string; blob: Blob }>,
  zipName = 'tinysqueeze-compressed.zip',
): Promise<void> {
  const zip = new JSZip();
  for (const item of items) {
    zip.file(item.name, item.blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, zipName);
}

/** Trigger a save-as download for a single blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Sequential download fallback (if ZIP API unavailable or user prefers). */
export async function downloadAllSequentially(
  items: Array<{ name: string; blob: Blob }>,
  delayMs = 300,
): Promise<void> {
  for (const item of items) {
    downloadBlob(item.blob, item.name);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
}