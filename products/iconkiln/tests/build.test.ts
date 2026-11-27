import { describe, it, expect } from 'vitest';
import { assetBaseName, perSizeFileName } from '../src/core/build';

describe('build: assetBaseName (ICK-012)', () => {
  it('strips extension and slugifies', () => {
    expect(assetBaseName('My Logo.PNG')).toBe('my-logo');
    expect(assetBaseName('mark-1024.png')).toBe('mark-1024');
    expect(assetBaseName('photo_sample.png')).toBe('photo_sample');
  });
  it('falls back to "icon" for empty stems', () => {
    expect(assetBaseName('.png')).toBe('icon');
  });
});

describe('build: perSizeFileName (ICK-012, WF-4 D2)', () => {
  it('formats name-<W>x<H>.png', () => {
    expect(perSizeFileName('myapp', { w: 32, h: 32 })).toBe('myapp-32x32.png');
    expect(perSizeFileName('icon', { w: 48, h: 64 })).toBe('icon-48x64.png');
  });
});