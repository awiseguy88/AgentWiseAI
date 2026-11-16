import { describe, it, expect, vi } from 'vitest';
import { getOutputFormats, getFormatInfo, isLossyFormat } from '../src/engine/formats';

describe('output formats (FR-005, FR-006, M2-A6)', () => {
  it('lists original, jpeg, webp, png, avif', () => {
    const ids = getOutputFormats().map(f => f.id);
    expect(ids).toEqual(['original', 'jpeg', 'webp', 'png', 'avif']);
  });

  it('png is not lossy; jpeg/webp/avif are lossy', () => {
    expect(isLossyFormat('png')).toBe(false);
    expect(isLossyFormat('jpeg')).toBe(true);
    expect(isLossyFormat('webp')).toBe(true);
    expect(isLossyFormat('avif')).toBe(true);
  });

  it('M2-A6 AVIF gated by browser capability', () => {
    const avif = getFormatInfo('avif')!;
    // In a non-browser (test) environment AVIF encoding is unavailable, so it is unsupported.
    expect(avif.supported).toBe(false);
    expect(avif.gated).toBeDefined();
    expect(avif.gated).toContain('AVIF');
  });

  it('mime and ext mapping is correct', () => {
    expect(getFormatInfo('jpeg')?.mime).toBe('image/jpeg');
    expect(getFormatInfo('jpeg')?.ext).toBe('jpg');
    expect(getFormatInfo('png')?.ext).toBe('png');
    expect(getFormatInfo('webp')?.ext).toBe('webp');
  });
});