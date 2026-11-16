import { describe, it, expect } from 'vitest';
import { encodeSettingsHash, decodeSettingsHash } from '../src/engine/share';
import { DEFAULT_SETTINGS } from '../src/engine/settings';

describe('shareable URL hash (FR-024)', () => {
  it('round-trips settings through hash', () => {
    const s = { ...DEFAULT_SETTINGS, targetWidth: 500, targetHeight: 300, resizeMode: 'cover' as const, quality: 80, theme: 'dark' as const };
    const hash = encodeSettingsHash(s);
    expect(hash.startsWith('#s=')).toBe(true);
    const decoded = decodeSettingsHash(hash);
    expect(decoded?.targetWidth).toBe(500);
    expect(decoded?.targetHeight).toBe(300);
    expect(decoded?.resizeMode).toBe('cover');
    expect(decoded?.quality).toBe(80);
    expect(decoded?.theme).toBe('dark');
  });

  it('decodes to defaults for malformed hash', () => {
    expect(decodeSettingsHash('garbage')).toBe(null);
    expect(decodeSettingsHash('#s=notbase64')).toBe(null);
  });

  it('contains no image data', () => {
    const hash = encodeSettingsHash(DEFAULT_SETTINGS);
    expect(hash).not.toContain('data:image');
    expect(hash.length).toBeLessThan(1000);
  });
});