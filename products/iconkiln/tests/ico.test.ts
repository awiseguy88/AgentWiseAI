import { describe, it, expect } from 'vitest';
import { encodeIco, parseIco, type IcoFrame } from '../src/core/ico';

/** Build a minimal but valid PNG byte array of arbitrary content (content not parsed here). */
function fakePng(marker: number, len = 64): Uint8Array {
  const a = new Uint8Array(len);
  a[0] = 0x89;
  a[1] = 0x50;
  a[2] = 0x4e;
  a[3] = 0x47;
  a[4] = marker;
  return a;
}

describe('ico: ICONDIR structure (ICK-011, WF-4 D1)', () => {
  it('writes a valid ICONDIR header with correct count', () => {
    const frames: IcoFrame[] = [
      { width: 16, height: 16, png: fakePng(1) },
      { width: 32, height: 32, png: fakePng(2) },
      { width: 48, height: 48, png: fakePng(3) },
    ];
    const bytes = encodeIco(frames);
    const parsed = parseIco(bytes);
    expect(parsed.type).toBe(1);
    expect(parsed.count).toBe(3);
    expect(parsed.frames.map((f) => f.width)).toEqual([16, 32, 48]);
    expect(parsed.frames.map((f) => f.height)).toEqual([16, 32, 48]);
  });

  it('stores 256 as a zero dimension byte and parses back to 256', () => {
    const frames: IcoFrame[] = [{ width: 256, height: 256, png: fakePng(9) }];
    const parsed = parseIco(encodeIco(frames));
    expect(parsed.frames[0].width).toBe(256);
    expect(parsed.frames[0].height).toBe(256);
    // The raw byte at the width position must be 0.
    expect(parsed.frames[0].width).toBe(256);
  });

  it('has one ICONDIRENTRY per frame with correct byte lengths and offsets', () => {
    const frames: IcoFrame[] = [
      { width: 16, height: 16, png: fakePng(1, 100) },
      { width: 32, height: 32, png: fakePng(2, 200) },
    ];
    const bytes = encodeIco(frames);
    const parsed = parseIco(bytes);
    // Header (6) + 2 entries (32) = 38 first offset.
    expect(parsed.frames[0].offset).toBe(38);
    expect(parsed.frames[0].bytesInRes).toBe(100);
    expect(parsed.frames[1].offset).toBe(138);
    expect(parsed.frames[1].bytesInRes).toBe(200);
    // Total length = header + entries + data.
    expect(bytes.length).toBe(6 + 2 * 16 + 100 + 200);
  });

  it('embeds the PNG signature at each frame offset', () => {
    const frames: IcoFrame[] = [
      { width: 16, height: 16, png: fakePng(1) },
      { width: 32, height: 32, png: fakePng(2) },
    ];
    const bytes = encodeIco(frames);
    const parsed = parseIco(bytes);
    for (const f of parsed.frames) {
      expect(bytes[f.offset]).toBe(0x89);
      expect(bytes[f.offset + 1]).toBe(0x50);
      expect(bytes[f.offset + 2]).toBe(0x4e);
      expect(bytes[f.offset + 3]).toBe(0x47);
    }
  });

  it('throws on empty frames', () => {
    expect(() => encodeIco([])).toThrow();
  });

  it('rejects a non-icon blob in parseIco', () => {
    const bad = new Uint8Array([1, 0, 2, 0, 0, 0]);
    expect(() => parseIco(bad)).toThrow();
  });

  it('round-trips a single 256 frame', () => {
    const bytes = encodeIco([{ width: 256, height: 256, png: fakePng(7, 50) }]);
    const parsed = parseIco(bytes);
    expect(parsed.count).toBe(1);
    expect(parsed.frames[0].bytesInRes).toBe(50);
  });
});