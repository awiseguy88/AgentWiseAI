import { describe, it, expect } from 'vitest';
import {
  parseCustomSizes,
  mergeSizes,
  clampSize,
  isSupportedType,
  resolveType,
  sizeKey,
  clampDimensionToByte,
  MIN_SIZE,
  MAX_SIZE,
} from '../src/core/sizes';

describe('sizes: custom parsing (ICK-007, WF-2 B2/B3)', () => {
  it('parses "30x30,60x60" into exactly two sizes', () => {
    const r = parseCustomSizes('30x30,60x60');
    expect(r.errors).toHaveLength(0);
    expect(r.sizes).toEqual([
      { w: 30, h: 30 },
      { w: 60, h: 60 },
    ]);
  });

  it('treats a bare number as square', () => {
    const r = parseCustomSizes('64');
    expect(r.sizes).toEqual([{ w: 64, h: 64 }]);
  });

  it('clamps 10x10 up to 16x16 and flags clamped (B3)', () => {
    const r = parseCustomSizes('10x10');
    expect(r.sizes).toEqual([{ w: 16, h: 16 }]);
    expect(r.clamped).toBe(true);
  });

  it('clamps 999x999 down to 256x256', () => {
    const r = parseCustomSizes('999x999');
    expect(r.sizes).toEqual([{ w: 256, h: 256 }]);
    expect(r.clamped).toBe(true);
  });

  it('reports an error for non-numeric tokens', () => {
    const r = parseCustomSizes('abc,32x32');
    expect(r.errors.length).toBe(1);
    expect(r.sizes).toEqual([{ w: 32, h: 32 }]);
  });

  it('errors on empty input', () => {
    const r = parseCustomSizes('   ');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.sizes).toHaveLength(0);
  });

  it('handles mixed valid and invalid gracefully', () => {
    const r = parseCustomSizes('32x32, oops , 48x48');
    expect(r.sizes).toEqual([
      { w: 32, h: 32 },
      { w: 48, h: 48 },
    ]);
    expect(r.errors.length).toBe(1);
  });
});

describe('sizes: clampSize', () => {
  it('clamps to range', () => {
    expect(clampSize(8)).toBe(MIN_SIZE);
    expect(clampSize(1000)).toBe(MAX_SIZE);
    expect(clampSize(64)).toBe(64);
  });
  it('handles NaN', () => {
    expect(clampSize(NaN)).toBe(MIN_SIZE);
  });
});

describe('sizes: mergeSizes dedupe + sort', () => {
  it('merges presets and custom, dedupes, sorts by area', () => {
    const merged = mergeSizes([32, 16], [{ w: 32, h: 32 }, { w: 64, h: 64 }]);
    expect(merged).toEqual([
      { w: 16, h: 16 },
      { w: 32, h: 32 },
      { w: 64, h: 64 },
    ]);
  });
});

describe('sizes: type support (ICK-002)', () => {
  it('accepts all supported types', () => {
    for (const t of ['image/png', 'image/svg+xml', 'image/jpeg', 'image/bmp', 'image/gif', 'image/webp']) {
      expect(isSupportedType(t)).toBe(true);
    }
  });
  it('rejects unsupported types', () => {
    expect(isSupportedType('text/plain')).toBe(false);
    expect(isSupportedType('image/tiff')).toBe(false);
  });
  it('resolves type from extension when missing', () => {
    expect(resolveType({ type: '', name: 'x.PNG' })).toBe('image/png');
    expect(resolveType({ type: '', name: 'x.svg' })).toBe('image/svg+xml');
    expect(resolveType({ type: '', name: 'x.unknown' })).toBe('');
  });
});

describe('sizes: ico dimension byte (ICK-011)', () => {
  it('maps 256 to 0 and others to themselves', () => {
    expect(clampDimensionToByte(256)).toBe(0);
    expect(clampDimensionToByte(32)).toBe(32);
    expect(clampDimensionToByte(16)).toBe(16);
  });
});

describe('sizes: sizeKey', () => {
  it('formats w x h', () => {
    expect(sizeKey({ w: 32, h: 48 })).toBe('32x48');
  });
});