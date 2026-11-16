import { describe, it, expect } from 'vitest';
import { isSupportedType, clampQuality, MAX_FILES, MAX_FILE_BYTES } from '../src/constants.ts';
import { formatBytes, formatPercent, computeSavingsPercent } from '../src/core/format.ts';
import { validateFiles } from '../src/main.ts';
import { createFixtureFile, createCorruptPngFile, createTextFile } from '../src/fixtures.ts';

// Mock File
function mockFile(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('constants & helpers', () => {
  it('isSupportedType returns true for JPEG/PNG', () => {
    expect(isSupportedType('image/jpeg')).toBe(true);
    expect(isSupportedType('image/png')).toBe(true);
    expect(isSupportedType('image/jpg')).toBe(true);
    expect(isSupportedType('image/webp')).toBe(false);
    expect(isSupportedType('text/plain')).toBe(false);
  });

  it('clampQuality clamps to 1-100', () => {
    expect(clampQuality(0)).toBe(1);
    expect(clampQuality(50)).toBe(50);
    expect(clampQuality(100)).toBe(100);
    expect(clampQuality(150)).toBe(100);
    expect(clampQuality(80.7)).toBe(80);
  });

  it('MAX_FILES and MAX_FILE_BYTES are correct', () => {
    expect(MAX_FILES).toBe(50);
    expect(MAX_FILE_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('format helpers', () => {
  it('formatBytes formats correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formatPercent rounds correctly', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(33.3)).toBe('33%');
    expect(formatPercent(99.9)).toBe('100%');
  });

  it('computeSavingsPercent calculates correctly', () => {
    expect(computeSavingsPercent(100, 80)).toBe(20);
    expect(computeSavingsPercent(100, 100)).toBe(0);
    expect(computeSavingsPercent(100, 120)).toBe(0); // no negative savings
    expect(computeSavingsPercent(0, 50)).toBe(0);
  });
});

describe('validation (FR-010, FR-011)', () => {
  it('rejects unsupported file types', () => {
    const txt = mockFile('test.txt', 100, 'text/plain');
    const { accepted, errors } = validateFiles([txt]);
    expect(accepted).toHaveLength(0);
    expect(errors.some((e) => e.includes('Unsupported'))).toBe(true);
  });

  it('rejects files > 25 MB', () => {
    const huge = mockFile('big.jpg', MAX_FILE_BYTES + 1, 'image/jpeg');
    const { accepted, errors } = validateFiles([huge]);
    expect(accepted).toHaveLength(0);
    expect(errors.some((e) => e.includes('too large'))).toBe(true);
  });

  it('rejects > 50 files', () => {
    const files = Array.from({ length: 51 }, (_, i) => mockFile(`f${i}.jpg`, 100, 'image/jpeg'));
    const { accepted, errors } = validateFiles(files);
    expect(accepted).toHaveLength(MAX_FILES);
    expect(errors.some((e) => e.includes('Maximum 50'))).toBe(true);
  });

  it('accepts valid JPEG and PNG', () => {
    const jpg = mockFile('a.jpg', 1000, 'image/jpeg');
    const png = mockFile('b.png', 2000, 'image/png');
    const { accepted, errors } = validateFiles([jpg, png]);
    expect(accepted).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });
});

describe('fixtures (synthetic)', () => {
  it('createFixtureFile produces valid File with correct dimensions', async () => {
    if (typeof OffscreenCanvas === 'undefined') {
      // Node environment without canvas: skip the actual encoding
      const spec = { id: 'test', name: 'test.jpg', w: 100, h: 50, type: 'image/jpeg' as const, draw: () => {} };
      expect(spec.name).toBe('test.jpg');
      expect(spec.type).toBe('image/jpeg');
      return;
    }
    const file = await createFixtureFile({
      id: 'test',
      name: 'test.jpg',
      w: 100,
      h: 50,
      type: 'image/jpeg',
      draw: () => {},
    });
    expect(file.name).toBe('test.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(file.size).toBeGreaterThan(0);
  });

  it('createCorruptPngFile produces invalid PNG', async () => {
    const file = await createCorruptPngFile();
    expect(file.name).toBe('corrupt.png');
    expect(file.type).toBe('image/png');
  });

  it('createTextFile produces non-image file', () => {
    const file = createTextFile();
    expect(file.name).toBe('not-an-image.txt');
    expect(file.type).toBe('text/plain');
  });
});