export const EXIF_ORIENTATION_TAG = 0x0112;

function readUint16BE(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}
function readUint32BE(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function skipIfdEntries(view: DataView, offset: number, count: number): number {
  return offset + 2 + count * 12;
}

export function findOrientationTag(buffer: ArrayBuffer): number | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 12) return null;
    if (readUint16BE(view, 0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = readUint16BE(view, offset + 2);
      if (size < 2) break;
      if (marker === 0xe1 && offset + 10 <= view.byteLength && readUint32BE(view, offset + 4) === 0x45786966) {
        const tiff = offset + 10;
        if (tiff + 8 <= view.byteLength) {
          const le = view.getUint16(tiff, false) === 0x4949;
          const ifdOffset = tiff + (le ? view.getUint32(tiff + 4, true) : readUint32BE(view, tiff + 4));
          if (ifdOffset > 0 && ifdOffset + 2 <= view.byteLength) {
            const entries = le ? view.getUint16(ifdOffset, true) : readUint16BE(view, ifdOffset);
            let p = ifdOffset + 2;
            for (let i = 0; i < entries && p + 12 <= view.byteLength; i++) {
              const tag = le ? view.getUint16(p, true) : readUint16BE(view, p);
              if (tag === EXIF_ORIENTATION_TAG) {
                const type = le ? view.getUint16(p + 2, true) : readUint16BE(view, p + 2);
                const count = le ? view.getUint32(p + 4, true) : readUint32BE(view, p + 4);
                if (count === 1) {
                  if (type === 3) return le ? view.getUint16(p + 8, true) : readUint16BE(view, p + 8);
                  if (type === 4) return le ? view.getUint32(p + 8, true) : readUint32BE(view, p + 8);
                }
                return null;
              }
              p += 12;
            }
          }
        }
      }
      offset += 2 + size;
    }
  } catch {
    return null;
  }
  return null;
}

export function orientationToTransform(o: number): { swap: boolean; rotateDeg: number; flipX: boolean; flipY: boolean } {
  switch (o) {
    case 2: return { swap: false, rotateDeg: 0, flipX: true, flipY: false };
    case 3: return { swap: false, rotateDeg: 180, flipX: false, flipY: false };
    case 4: return { swap: false, rotateDeg: 0, flipX: false, flipY: true };
    case 5: return { swap: true, rotateDeg: 90, flipX: true, flipY: false };
    case 6: return { swap: true, rotateDeg: 90, flipX: false, flipY: false };
    case 7: return { swap: true, rotateDeg: 90, flipX: false, flipY: true };
    case 8: return { swap: true, rotateDeg: -90, flipX: false, flipY: false };
    default: return { swap: false, rotateDeg: 0, flipX: false, flipY: false };
  }
}
