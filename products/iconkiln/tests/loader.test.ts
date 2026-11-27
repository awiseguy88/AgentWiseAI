import { describe, it, expect } from 'vitest';
import { validateFile, SourceLoadError } from '../src/core/loader';
import { MAX_FILE_BYTES } from '../src/core/sizes';

describe('loader: validateFile (ICK-002, ICK-003, WF-1 A2/A3)', () => {
  it('accepts a supported PNG within size limit', () => {
    const msg = validateFile({ type: 'image/png', name: 'a.png', size: 1024 });
    expect(msg).toBe('');
  });

  it('rejects a .txt as unsupported (A2)', () => {
    const msg = validateFile({ type: 'text/plain', name: 'notes.txt', size: 100 });
    expect(msg).toMatch(/not a supported image/);
  });

  it('rejects an oversized image (A3)', () => {
    const msg = validateFile({ type: 'image/png', name: 'big.png', size: MAX_FILE_BYTES + 1 });
    expect(msg).toMatch(/too large/);
  });

  it('accepts SVG by extension when type missing', () => {
    const msg = validateFile({ type: '', name: 'mark.svg', size: 500 });
    expect(msg).toBe('');
  });

  it('rejects unknown extension with no type', () => {
    const msg = validateFile({ type: '', name: 'file.xyz', size: 500 });
    expect(msg).toMatch(/not a supported image/);
  });

  it('accepts each supported type', () => {
    for (const t of ['image/png', 'image/svg+xml', 'image/jpeg', 'image/bmp', 'image/gif', 'image/webp']) {
      expect(validateFile({ type: t, name: 'x', size: 10 })).toBe('');
    }
  });
});

describe('loader: SourceLoadError', () => {
  it('carries a kind', () => {
    const e = new SourceLoadError('unsupported', 'nope');
    expect(e.kind).toBe('unsupported');
    expect(e.message).toBe('nope');
  });
});