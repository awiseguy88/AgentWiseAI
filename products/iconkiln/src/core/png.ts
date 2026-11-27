/** Encode a canvas to PNG bytes (Uint8Array) using the browser's toBlob. */
export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('canvas.toBlob returned null'));
        return;
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      resolve(buf);
    }, 'image/png');
  });
}

/** Encode a canvas to a PNG data URL (used for live preview thumbnails). */
export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}