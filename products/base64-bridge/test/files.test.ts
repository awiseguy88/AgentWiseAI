import { describe, expect, it } from 'vitest';
import { createZip, crc32, base64ToFilename, decodedFilename, guessMimeFromName } from '../src/core/files';

describe('ZIP + helpers', () => {
  it('crc32 known value for "123456789"', () => {
    const data = new TextEncoder().encode('123456789');
    expect(crc32(data)).toBe(0xcbf43926);
  });

  it('createZip produces valid ZIP with local headers', () => {
    const entries = [
      { name: 'a.txt', data: new TextEncoder().encode('hello') },
      { name: 'b.txt', data: new TextEncoder().encode('world!') },
    ];
    const zip = createZip(entries);
    // ZIP starts with local file header signature 0x04034b50 (PK\x03\x04)
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    // Contains EOCD signature at end
    const view = new DataView(zip.buffer);
    let foundEocd = false;
    for (let i = zip.length - 22; i >= 0 && i > zip.length - 100; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { foundEocd = true; break; }
    }
    expect(foundEocd).toBe(true);
  });

  it('base64ToFilename appends .b64 / .b64url', () => {
    expect(base64ToFilename('photo.png', 'standard')).toBe('photo.png.b64');
    expect(base64ToFilename('photo.png', 'url-safe')).toBe('photo.png.b64url');
    expect(base64ToFilename('already.b64', 'standard')).toBe('already.b64');
  });

  it('decodedFilename strips .b64 / .b64url', () => {
    expect(decodedFilename('photo.png.b64')).toBe('photo.png');
    expect(decodedFilename('photo.png.b64url')).toBe('photo.png');
    expect(decodedFilename('unknown.bin')).toBe('unknown.bin.decoded');
  });

  it('guessMimeFromName maps common extensions', () => {
    expect(guessMimeFromName('a.png')).toBe('image/png');
    expect(guessMimeFromName('a.json')).toBe('application/json');
    expect(guessMimeFromName('a.unknown')).toBe('application/octet-stream');
  });
});