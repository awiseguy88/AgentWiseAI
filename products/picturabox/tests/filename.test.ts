import { describe, it, expect } from 'vitest';
import { buildFilename } from '../src/engine/filename';

describe('filename pattern engine (M3)', () => {
  it('M3-A1 pictura_xxx produces zero-padded 3-digit names', () => {
    expect(buildFilename('pictura_xxx', 'photo.jpg', 1, 'webp')).toBe('pictura_001.webp');
    expect(buildFilename('pictura_xxx', 'photo.jpg', 2, 'webp')).toBe('pictura_002.webp');
    expect(buildFilename('pictura_xxx', 'photo.jpg', 3, 'webp')).toBe('pictura_003.webp');
  });

  it('original_resized preserves base name + _resized suffix', () => {
    expect(buildFilename('original_resized', 'vacation.png', 1, 'jpeg')).toBe('vacation_resized.jpg');
  });

  it('custom_{name} uses custom prefix + index', () => {
    expect(buildFilename('custom_{name}', 'photo.jpg', 5, 'png', 'banner')).toBe('banner_005.png');
  });

  it('original preserves base name with new extension', () => {
    expect(buildFilename('original', 'photo.jpg', 1, 'webp')).toBe('photo.webp');
  });

  it('M3-A5 zero-padded indices are unique in sequence', () => {
    const names = [1, 2, 3, 10, 99, 100].map(i => buildFilename('pictura_xxx', 'a.jpg', i, 'webp'));
    expect(new Set(names).size).toBe(names.length);
  });

  it('sanitizes custom name characters', () => {
    expect(buildFilename('custom_{name}', 'x.jpg', 1, 'png', 'my file (1)')).toBe('my_file_1__001.png');
  });
});