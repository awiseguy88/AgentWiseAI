import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  encodeTextToBase64,
  decodeBase64,
  bytesToText,
  encodeBytes,
  validateBase64,
  wrapBase64,
} from '../src/core/base64';
import type { EncodeOptions, DecodeOptions } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../public/fixtures');

const encDefaults = (over: Partial<EncodeOptions> = {}): EncodeOptions => ({
  variant: 'standard',
  charset: 'utf-8',
  newline: 'lf',
  wrap: 'none',
  perLine: false,
  live: false,
  ...over,
});

const decDefaults = (over: Partial<DecodeOptions> = {}): DecodeOptions => ({
  variant: 'standard',
  charset: 'utf-8',
  strict: true,
  autoDetect: true,
  ...over,
});

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('Base64 Bridge acceptance checks', () => {
  it('AT-01: Encode "foo" -> "Zm9v"', () => {
    const r = encodeTextToBase64('foo', encDefaults());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('Zm9v');
  });

  it('AT-02: Encode "fo" -> "Zm8="', () => {
    const r = encodeTextToBase64('fo', encDefaults());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('Zm8=');
  });

  it('AT-03: Encode "f" -> "Zg=="', () => {
    const r = encodeTextToBase64('f', encDefaults());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('Zg==');
  });

  it('AT-04: Decode "Zm9v" -> "foo"', () => {
    const r = decodeBase64('Zm9v', decDefaults());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const t = bytesToText(r.bytes, 'utf-8');
      expect(t.ok).toBe(true);
      if (t.ok) expect(t.text).toBe('foo');
    }
  });

  it('AT-05: URL-safe encoding transforms +,/ and removes padding', () => {
    // bytes that produce '+' (62) and '/' (63) in standard
    const plusBytes = new Uint8Array([0xfb, 0xef, 0xbe]); // -> "++++" std
    const stdPlus = encodeBytes(plusBytes, 'standard');
    const urlPlus = encodeBytes(plusBytes, 'url-safe');
    expect(stdPlus).toBe('++++');
    expect(urlPlus).toBe('----'); // no padding
    expect(urlPlus).not.toContain('+');

    const slashBytes = new Uint8Array([0xff, 0xff, 0xff]); // -> "////" std
    const stdSlash = encodeBytes(slashBytes, 'standard');
    const urlSlash = encodeBytes(slashBytes, 'url-safe');
    expect(stdSlash).toBe('////');
    expect(urlSlash).toBe('____');

    // padding removal: "f" -> "Zg==" std, "Zg" url-safe
    const fUrl = encodeTextToBase64('f', encDefaults({ variant: 'url-safe' }));
    expect(fUrl.ok).toBe(true);
    if (fUrl.ok) expect(fUrl.text).toBe('Zg');
    expect(urlSlash).not.toContain('=');
  });

  it('AT-06: 76-char wrapping produces valid line lengths', () => {
    // 100 bytes -> 136 base64 chars (no padding for 100? 100%3=1 => 2 padding chars: ceil(100/3)*4=136)
    const bytes = new Uint8Array(100);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    const b64 = encodeBytes(bytes, 'standard');
    const wrapped = wrapBase64(b64, 'mime76', 'lf');
    const lines = wrapped.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (let i = 0; i < lines.length - 1; i++) {
      expect(lines[i].length).toBe(76);
    }
    expect(lines[lines.length - 1].length).toBeLessThanOrEqual(76);
    expect(lines[lines.length - 1].length).toBeGreaterThan(0);
    // round-trip
    const decoded = decodeBase64(wrapped, decDefaults());
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(Array.from(decoded.bytes)).toEqual(Array.from(bytes));
  });

  it('AT-07: Binary file round-trip preserves hash (sample.png)', () => {
    const png = new Uint8Array(readFileSync(path.join(fixturesDir, 'sample.png')));
    const originalHash = sha256(png);
    const encoded = encodeBytes(png, 'standard');
    const decoded = decodeBase64(encoded, decDefaults());
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(sha256(decoded.bytes)).toBe(originalHash);
      expect(decoded.bytes.byteLength).toBe(png.byteLength);
      expect(Array.from(decoded.bytes)).toEqual(Array.from(png));
    }
  });

  it('AT-08: Invalid Base64 shows inline error', () => {
    const r = decodeBase64('!!!not-base64!!!', decDefaults());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();

    const r2 = decodeBase64('Zm9v====', decDefaults());
    expect(r2.ok).toBe(false);

    const r3 = decodeBase64('A', decDefaults()); // invalid length
    expect(r3.ok).toBe(false);
  });
});

describe('Additional core behaviors', () => {
  it('auto-detects URL-safe on decode', () => {
    const encoded = encodeTextToBase64('subjects?_d', encDefaults({ variant: 'url-safe' }));
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = decodeBase64(encoded.text, decDefaults({ autoDetect: true }));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.detectedVariant).toBe('url-safe');
      const t = bytesToText(decoded.bytes, 'utf-8');
      expect(t.ok && t.text).toBe('subjects?_d');
    }
  });

  it('per-line encoding encodes each line separately', () => {
    const input = 'foo\nbar';
    const r = encodeTextToBase64(input, encDefaults({ perLine: true, newline: 'lf' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe('Zm9v\nYmFy');
    }
  });

  it('hello-world fixture round-trips as text', () => {
    const txt = readFileSync(path.join(fixturesDir, 'hello-world.txt'), 'utf8');
    const enc = encodeTextToBase64(txt, encDefaults());
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decodeBase64(enc.text, decDefaults());
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    const out = bytesToText(dec.bytes, 'utf-8');
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.text).toBe(txt);
  });

  it('data-sample fixture round-trips', () => {
    const json = readFileSync(path.join(fixturesDir, 'data-sample.json'), 'utf8');
    const enc = encodeTextToBase64(json, encDefaults());
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decodeBase64(enc.text, decDefaults());
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    const out = bytesToText(dec.bytes, 'utf-8');
    expect(out.ok && out.text).toBe(json);
  });
});
