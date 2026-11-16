import { describe, it, expect } from 'vitest';
import { buildFilename } from '../src/engine/filename';

describe('filename pattern engine', () => {
  it('M3-A1 pixtrim_xxx produces zero-padded 3-digit names', () => {
    expect(buildFilename('pixtrim', 'photo.jpg', 1, 'webp')).toBe('pixtrim_001.webp');
    expect(buildFilename('pixtrim', 'photo.jpg', 2, 'webp')).toBe('pixtrim_002.webp');
    expect(buildFilename('pixtrim', 'photo.jpg', 3, 'webp')).toBe('pixtrim_003.webp');
  });

  it('original_resized preserves base name', () => {
    expect(buildFilename('original_resized', 'vacation.png', 1, 'jpeg')).toBe('vacation_resized.jpg');
  });

  it('custom pattern uses custom prefix', () => {
    expect(buildFilename('custom', 'photo.jpg', 5, 'png', 'banner')).toBe('banner_005.png');
  });

  it('original preserves name with new extension', () => {
    expect(buildFilename('original', 'photo.jpg', 1, 'webp')).toBe('photo.webp');
  });

  it('M3-A5 zero-padded indices are unique in sequence', () => {
    const names = [1, 2, 3, 10, 99, 100].map(i => buildFilename('pixtrim', 'a.jpg', i, 'webp'));
    expect(new Set(names).size).toBe(names.length);
  });
});
