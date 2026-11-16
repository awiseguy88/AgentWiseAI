import { describe, it, expect } from 'vitest';
import { findOrientationTag, orientationToTransform, EXIF_ORIENTATION_TAG } from '../src/engine/exif';

/**
 * Build a minimal JPEG byte array containing an APP1/Exif segment with a single
 * IFD0 entry for the orientation tag (0x0112), type SHORT, count 1, value N.
 * Layout:
 *   SOI(FF D8)
 *   APP1 marker (FF E1) + length(u16 BE)
 *   "Exif\0\0" (6 bytes)
 *   TIFF header: byte order ("II" or "MM"), 0x002A, offset to IFD0
 *   IFD0: entry count(u16) + entry(12 bytes) + next-IFD offset(u32)
 */
function makeJpegWithOrientation(orientation: number, littleEndian = true): ArrayBuffer {
  const buf: number[] = [];
  // SOI
  buf.push(0xff, 0xd8);
  // APP1 marker
  buf.push(0xff, 0xe1);
  // We'll compute length after building payload
  const payload: number[] = [];
  // "Exif\0\0"
  for (const ch of [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]) payload.push(ch);
  const tiffStart = payload.length; // offset of TIFF header within payload
  if (littleEndian) {
    payload.push(0x49, 0x49); // "II"
    payload.push(0x2a, 0x00); // 0x002A little-endian
    payload.push(0x08, 0x00, 0x00, 0x00); // IFD0 at offset 8
  } else {
    payload.push(0x4d, 0x4d); // "MM"
    payload.push(0x00, 0x2a); // 0x002A big-endian
    payload.push(0x00, 0x00, 0x00, 0x08); // IFD0 at offset 8
  }
  // IFD0
  if (littleEndian) {
    payload.push(0x01, 0x00); // 1 entry
    payload.push(0x12, 0x01); // tag 0x0112 little-endian
    payload.push(0x03, 0x00); // type SHORT
    payload.push(0x01, 0x00, 0x00, 0x00); // count 1
    payload.push(orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00); // value
    payload.push(0x00, 0x00, 0x00, 0x00); // next IFD offset
  } else {
    payload.push(0x00, 0x01); // 1 entry
    payload.push(0x01, 0x12); // tag 0x0112 big-endian
    payload.push(0x00, 0x03); // type SHORT
    payload.push(0x00, 0x00, 0x00, 0x01); // count 1
    payload.push(0x00, 0x00, orientation & 0xff, (orientation >> 8) & 0xff); // value
    payload.push(0x00, 0x00, 0x00, 0x00); // next IFD offset
  }
  // APP1 length = payload.length + 2 (includes the length field itself)
  const len = payload.length + 2;
  buf.push((len >> 8) & 0xff, len & 0xff);
  for (const b of payload) buf.push(b);
  // EOI
  buf.push(0xff, 0xd9);
  const out = new Uint8Array(buf);
  return out.buffer;
}

describe('EXIF orientation (M5)', () => {
  it('parses orientation 1 (normal)', () => {
    const buf = makeJpegWithOrientation(1);
    expect(findOrientationTag(buf)).toBe(1);
  });

  it('M5-A2 parses portrait JPEG orientation 6', () => {
    const buf = makeJpegWithOrientation(6);
    expect(findOrientationTag(buf)).toBe(6);
  });

  it('orientation 6 rotates 90deg and swaps dimensions', () => {
    const t = orientationToTransform(6);
    expect(t.swap).toBe(true);
    expect(t.rotateDeg).toBe(90);
  });

  it('orientation 8 rotates -90deg', () => {
    const t = orientationToTransform(8);
    expect(t.swap).toBe(true);
    expect(t.rotateDeg).toBe(-90);
  });

  it('orientation 3 rotates 180', () => {
    const t = orientationToTransform(3);
    expect(t.rotateDeg).toBe(180);
    expect(t.swap).toBe(false);
  });



  it('returns null for non-JPEG data', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // PNG magic
    expect(findOrientationTag(buf)).toBe(null);
  });

  it('returns null for too-short buffer', () => {
    expect(findOrientationTag(new Uint8Array([0xff, 0xd8]).buffer)).toBe(null);
  });
});