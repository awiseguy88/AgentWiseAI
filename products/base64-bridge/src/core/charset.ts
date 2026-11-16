// Base64 Bridge — charset encoding/decoding.
// Supports UTF-8 (native), ASCII, ISO-8859-1 (Latin-1), Windows-1252, UTF-16LE, UTF-16BE.
// No external dependencies; all implemented in pure JS.

import type { Charset } from '../types';

// CP1252 mapping for 0x80–0x9F (C1 controls → printable chars in CP1252)
const CP1252_TO_UNICODE: number[] = [
  0x20ac, // 0x80 €
  0x0081, // 0x81 (undefined) → C1 control
  0x201a, // 0x82 ‚
  0x0192, // 0x83 ƒ
  0x201e, // 0x84 „
  0x2026, // 0x85 …
  0x2020, // 0x86 †
  0x2021, // 0x87 ‡
  0x02c6, // 0x88 ˆ
  0x2030, // 0x89 ‰
  0x0160, // 0x8A Š
  0x2039, // 0x8B ‹
  0x0152, // 0x8C Œ
  0x008d, // 0x8D (undefined) → C1 control
  0x017d, // 0x8E Ž
  0x008f, // 0x8F (undefined) → C1 control
  0x0090, // 0x90 (undefined) → C1 control
  0x2018, // 0x91 '
  0x2019, // 0x92 '
  0x201c, // 0x93 "
  0x201d, // 0x94 "
  0x2022, // 0x95 •
  0x2013, // 0x96 –
  0x2014, // 0x97 —
  0x02dc, // 0x98 ˜
  0x2122, // 0x99 ™
  0x0161, // 0x9A š
  0x203a, // 0x9B ›
  0x0153, // 0x9C œ
  0x009d, // 0x9D (undefined) → C1 control
  0x017e, // 0x9E ž
  0x0178, // 0x9F Ÿ
];

// Reverse map for encoding to CP1252
const UNICODE_TO_CP1252: Map<number, number> = new Map();
for (let i = 0; i < CP1252_TO_UNICODE.length; i++) {
  const cp = 0x80 + i;
  const uni = CP1252_TO_UNICODE[i];
  UNICODE_TO_CP1252.set(uni, cp);
}

// CP1252 also has standard ASCII (0x00–0x7F) and Latin-1 (0xA0–0xFF) ranges.
function charToCp1252(code: number): number {
  if (code <= 0x7f) return code; // ASCII
  if (code >= 0xa0 && code <= 0xff) return code; // Latin-1 range identical
  const mapped = UNICODE_TO_CP1252.get(code);
  if (mapped !== undefined) return mapped;
  // Not representable in CP1252
  throw new Error(`Character U+${code.toString(16).toUpperCase().padStart(4, '0')} cannot be represented in Windows-1252`);
}

export function charsetEncode(text: string, charset: Charset): Uint8Array {
  switch (charset) {
    case 'utf-8': {
      return new TextEncoder().encode(text);
    }
    case 'utf-16-le': {
      // JS strings are UTF-16; we can iterate code units directly.
      const out = new Uint8Array(text.length * 2);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        out[i * 2] = code & 0xff;
        out[i * 2 + 1] = (code >> 8) & 0xff;
      }
      return out;
    }
    case 'utf-16-be': {
      const out = new Uint8Array(text.length * 2);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        out[i * 2] = (code >> 8) & 0xff;
        out[i * 2 + 1] = code & 0xff;
      }
      return out;
    }
    case 'ascii': {
      const out = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code > 0x7f) {
          throw new Error(`ASCII cannot encode character U+${code.toString(16).toUpperCase().padStart(4, '0')} (code point > 127)`);
        }
        out[i] = code;
      }
      return out;
    }
    case 'iso-8859-1': {
      const out = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code > 0xff) {
          throw new Error(`ISO-8859-1 cannot encode character U+${code.toString(16).toUpperCase().padStart(4, '0')} (code point > 255)`);
        }
        out[i] = code;
      }
      return out;
    }
    case 'cp1252': {
      const out = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        out[i] = charToCp1252(code);
      }
      return out;
    }
    default: {
      const _exhaustive: never = charset;
      throw new Error(`Unknown charset: ${_exhaustive}`);
    }
  }
}

export function charsetDecode(bytes: Uint8Array, charset: Charset): string {
  switch (charset) {
    case 'utf-8': {
      // Use TextDecoder with fatal to surface invalid sequences.
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    case 'utf-16-le': {
      if (bytes.length % 2 !== 0) throw new Error('UTF-16LE data has an odd number of bytes');
      const chars: string[] = [];
      for (let i = 0; i < bytes.length; i += 2) {
        const code = bytes[i] | (bytes[i + 1] << 8);
        chars.push(String.fromCharCode(code));
      }
      // Optionally strip BOM U+FEFF at start
      if (chars[0] === '\ufeff') chars.shift();
      return chars.join('');
    }
    case 'utf-16-be': {
      if (bytes.length % 2 !== 0) throw new Error('UTF-16BE data has an odd number of bytes');
      const chars: string[] = [];
      for (let i = 0; i < bytes.length; i += 2) {
        const code = (bytes[i] << 8) | bytes[i + 1];
        chars.push(String.fromCharCode(code));
      }
      if (chars[0] === '\ufeff') chars.shift();
      return chars.join('');
    }
    case 'ascii': {
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] > 0x7f) {
          throw new Error(`ASCII decoding failed: byte 0x${bytes[i].toString(16).padStart(2, '0')} > 127 at position ${i}`);
        }
      }
      return String.fromCharCode(...bytes);
    }
    case 'iso-8859-1': {
      // 1:1 mapping 0x00–0xFF
      return String.fromCharCode(...bytes);
    }
    case 'cp1252': {
      const chars: string[] = [];
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b >= 0x80 && b <= 0x9f) {
          chars.push(String.fromCharCode(CP1252_TO_UNICODE[b - 0x80]));
        } else {
          chars.push(String.fromCharCode(b));
        }
      }
      return chars.join('');
    }
    default: {
      const _exhaustive: never = charset;
      throw new Error(`Unknown charset: ${_exhaustive}`);
    }
  }
}