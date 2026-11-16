import { describe, it, expect } from 'vitest';
import { encodeSettingsHash, decodeSettingsHash } from '../src/engine/share';
import { DEFAULT_SETTINGS } from '../src/engine/settings';

describe('shareable URL hash settings', () => {
  it('M4/FR-024 encodes and decodes settings round-trip', () => {
    const s = { ...DEFAULT_SETTINGS, width: 800, height: 600, mode: 'exact' as const, format: 'webp' as const, quality: 85, theme: 'dark' as const };
    const hash = encodeSettingsHash(s);
    expect(hash.startsWith('#s=')).toBe(true);
    const decoded = decodeSettingsHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.width).toBe(800);
    expect(decoded!.height).toBe(600);
    expect(decoded!.mode).toBe('exact');
    expect(decoded!.format).toBe('webp');
    expect(decoded!.quality).toBe(85);
    expect(decoded!.theme).toBe('dark');
  });

  it('returns null for invalid hash', () => {
    expect(decodeSettingsHash('#invalid')).toBeNull();
    expect(decodeSettingsHash('')).toBeNull();
  });
});
