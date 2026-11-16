import { describe, it, expect } from 'vitest';
import { applyRenamePattern, padSequential, splitName } from '../src/core/rename.ts';

describe('rename pattern logic', () => {
  it('pads sequential numbers to 3 digits', () => {
    expect(padSequential(1)).toBe('001');
    expect(padSequential(12)).toBe('012');
    expect(padSequential(100)).toBe('100');
    expect(padSequential(1000)).toBe('1000');
  });

  it('replaces xxx with sequential number', () => {
    expect(applyRenamePattern({ pattern: 'fitframe_xxx', start: 1, index: 0, originalName: 'photo', ext: 'webp' })).toBe('fitframe_001.webp');
    expect(applyRenamePattern({ pattern: 'fitframe_xxx', start: 1, index: 1, originalName: 'photo', ext: 'webp' })).toBe('fitframe_002.webp');
    expect(applyRenamePattern({ pattern: 'fitframe_xxx', start: 1, index: 2, originalName: 'photo', ext: 'webp' })).toBe('fitframe_003.webp');
  });

  it('uses ORIGINAL-NAME placeholder', () => {
    expect(applyRenamePattern({ pattern: 'ORIGINAL-NAME_xxx', start: 5, index: 0, originalName: 'vacation', ext: 'jpg' })).toBe('vacation_005.jpg');
  });

  it('uses start number', () => {
    expect(applyRenamePattern({ pattern: 'xxx', start: 10, index: 0, originalName: 'x', ext: 'png' })).toBe('010.png');
    expect(applyRenamePattern({ pattern: 'xxx', start: 10, index: 2, originalName: 'x', ext: 'png' })).toBe('012.png');
  });

  it('strips unsafe filename characters', () => {
    const out = applyRenamePattern({ pattern: 'bad:file/xxx', start: 1, index: 0, originalName: 'a', ext: 'png' });
    expect(out).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('splitName handles extension', () => {
    expect(splitName('photo.png')).toEqual({ base: 'photo', ext: 'png' });
    expect(splitName('archive.tar.gz')).toEqual({ base: 'archive.tar', ext: 'gz' });
    expect(splitName('noext')).toEqual({ base: 'noext', ext: '' });
  });
});