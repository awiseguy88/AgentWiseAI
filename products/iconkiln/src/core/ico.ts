import { clampDimensionToByte } from './sizes';

export interface IcoFrame {
  width: number;
  height: number;
  /** PNG-encoded image bytes for this frame. */
  png: Uint8Array;
}

const ICONDIR_RESERVED = 0;
const ICONDIR_TYPE_ICON = 1;
const ICONDIRENTRY_PLANES = 1;
const ICONDIRENTRY_BITCOUNT = 32;

/**
 * Encode a multi-resolution .ico (ICONDIR) with one ICONDIRENTRY per frame and
 * PNG-encoded image blocks. Each frame's `png` must already be a valid PNG.
 *
 * Layout:
 *   ICONDIR        (6 bytes)
 *   ICONDIRENTRY[] (16 bytes * count)
 *   PNG blocks     (concatenated, in the same order as the entries)
 */
export function encodeIco(frames: IcoFrame[]): Uint8Array {
  if (frames.length === 0) throw new Error('encodeIco: at least one frame is required');
  if (frames.length > 65535) throw new Error('encodeIco: too many frames');

  const count = frames.length;
  const headerLen = 6 + count * 16;
  let dataOffset = headerLen;
  const totalLen = headerLen + frames.reduce((sum, f) => sum + f.png.length, 0);
  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);

  // ICONDIR
  view.setUint16(0, ICONDIR_RESERVED, true);
  view.setUint16(2, ICONDIR_TYPE_ICON, true);
  view.setUint16(4, count, true);

  // ICONDIRENTRY array + record offsets
  let entryPos = 6;
  for (const frame of frames) {
    const w = clampDimensionToByte(frame.width);
    const h = clampDimensionToByte(frame.height);
    out[entryPos + 0] = w; // width (0 => 256)
    out[entryPos + 1] = h; // height (0 => 256)
    out[entryPos + 2] = 0; // color count
    out[entryPos + 3] = 0; // reserved
    view.setUint16(entryPos + 4, ICONDIRENTRY_PLANES, true);
    view.setUint16(entryPos + 6, ICONDIRENTRY_BITCOUNT, true);
    view.setUint32(entryPos + 8, frame.png.length, true); // bytes in resource
    view.setUint32(entryPos + 12, dataOffset, true); // offset to image data
    entryPos += 16;
    dataOffset += frame.png.length;
  }

  // PNG image blocks
  let writePos = headerLen;
  for (const frame of frames) {
    out.set(frame.png, writePos);
    writePos += frame.png.length;
  }

  return out;
}

export interface ParsedIco {
  type: number;
  count: number;
  frames: Array<{ width: number; height: number; bytesInRes: number; offset: number }>;
}

/** Parse an ICO byte array back into its directory (for verification/tests). */
export function parseIco(bytes: Uint8Array): ParsedIco {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);
  if (reserved !== 0 || type !== 1) {
    throw new Error('parseIco: not a valid ICONDIR');
  }
  const frames: ParsedIco['frames'] = [];
  let p = 6;
  for (let i = 0; i < count; i++) {
    const widthByte = bytes[p + 0];
    const heightByte = bytes[p + 1];
    const bytesInRes = view.getUint32(p + 8, true);
    const offset = view.getUint32(p + 12, true);
    frames.push({
      width: widthByte === 0 ? 256 : widthByte,
      height: heightByte === 0 ? 256 : heightByte,
      bytesInRes,
      offset,
    });
    p += 16;
  }
  return { type, count, frames };
}