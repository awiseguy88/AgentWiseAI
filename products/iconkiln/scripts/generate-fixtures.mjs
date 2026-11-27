// Generates the original IconKiln fixtures as valid PNG files using only Node built-ins.
// Run: node scripts/generate-fixtures.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');
mkdirSync(FIX, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
}

// Rounded-rect signed distance (negative inside).
function roundRectSDF(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// Diamond (rotated square) ring SDF.
function diamondSDF(x, y, cx, cy, radius) {
  return Math.abs(x - cx) + Math.abs(y - cy) - radius;
}

function makeMark(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c1 = [124, 58, 237]; // purple
  const c2 = [219, 39, 119]; // pink
  const cx = size / 2;
  const cy = size / 2;
  const ss = 2; // supersample
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          const t = (px + py) / (2 * size);
          const bg = mix(c1, c2, t);
          // Rounded square background
          const bgd = roundRectSDF(px, py, cx, cy, size * 0.46, size * 0.46, size * 0.22);
          if (bgd > 0) continue;
          let col = bg;
          // White diamond ring
          const dd = Math.abs(diamondSDF(px, py, cx, cy, size * 0.27));
          const ringW = size * 0.03;
          if (dd < ringW) col = [255, 255, 255];
          // White rounded-square ring
          const sd = Math.abs(roundRectSDF(px, py, cx, cy, size * 0.2, size * 0.2, size * 0.07));
          if (sd < ringW) col = [255, 255, 255];
          // Center dot
          const cd = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
          if (cd < size * 0.06) col = [255, 255, 255];
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = ss * ss;
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(r / n);
      rgba[idx + 1] = Math.round(g / n);
      rgba[idx + 2] = Math.round(b / n);
      rgba[idx + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, size, rgba);
}

function makePhoto(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Warm gradient sky-to-ground
      let col = mix([250, 204, 21], [236, 72, 153], v);
      col = mix(col, [59, 130, 246], u * 0.6);
      // Sun disc
      const sd = Math.sqrt((u - 0.7) ** 2 + (v - 0.3) ** 2);
      if (sd < 0.14) col = [255, 247, 237];
      // Diagonal band
      if (Math.abs((u - v)) < 0.06) col = mix(col, [16, 185, 129], 0.5);
      const idx = (y * size + x) * 4;
      rgba[idx] = col[0]; rgba[idx + 1] = col[1]; rgba[idx + 2] = col[2]; rgba[idx + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

writeFileSync(join(FIX, 'mark-1024.png'), makeMark(1024));
writeFileSync(join(FIX, 'photo-sample.png'), makePhoto(512));
console.log('Wrote fixtures/mark-1024.png (1024x1024) and fixtures/photo-sample.png (512x512)');