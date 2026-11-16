import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportSingleFile, exportZip } from '../src/engine/export';

/**
 * jsdom does not implement CanvasRenderingContext2D.toBlob. We provide a
 * minimal HTMLCanvasElement-like mock that records toBlob calls so the export
 * pipeline (which only needs the blob + filename logic) can be exercised.
 */
function mockCanvas(): HTMLCanvasElement {
  return {
    width: 10,
    height: 10,
    toBlob: (cb: (b: Blob | null) => void, mime?: string) => {
      const blob = new Blob(['data'], { type: mime || 'image/png' });
      cb(blob);
    },
    getContext: () => null,
  } as unknown as HTMLCanvasElement;
}

describe('export pipeline (M3)', () => {
  it('M3-A2 single file export returns a blob', async () => {
    const blob = await exportSingleFile({
      canvas: mockCanvas(),
      originalName: 'photo.jpg',
      format: 'jpeg',
      quality: 90,
      pattern: 'pictura_xxx',
      customName: 'image',
      index: 1,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
  });

  it('M3-A1 ZIP contains zero-padded pictura_xxx names', async () => {
    const items = [
      { canvas: mockCanvas(), originalName: 'a.png', format: 'webp' as const, quality: 85, pattern: 'pictura_xxx' as const, customName: 'image', index: 1 },
      { canvas: mockCanvas(), originalName: 'b.png', format: 'webp' as const, quality: 85, pattern: 'pictura_xxx' as const, customName: 'image', index: 2 },
      { canvas: mockCanvas(), originalName: 'c.png', format: 'webp' as const, quality: 85, pattern: 'pictura_xxx' as const, customName: 'image', index: 3 },
    ];
    const blob = await exportZip(items);
    expect(blob).toBeInstanceOf(Blob);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['pictura_001.webp', 'pictura_002.webp', 'pictura_003.webp']);
  });

  it('M3-A4 progress callback fires for each item', async () => {
    const items = [
      { canvas: mockCanvas(), originalName: 'a.png', format: 'png' as const, quality: 100, pattern: 'pictura_xxx' as const, customName: 'image', index: 1 },
      { canvas: mockCanvas(), originalName: 'b.png', format: 'png' as const, quality: 100, pattern: 'pictura_xxx' as const, customName: 'image', index: 2 },
    ];
    const progress: number[] = [];
    await exportZip(items, (p) => progress.push(p.current));
    expect(progress).toEqual([1, 2]);
  });
});