// Base64 Bridge — core encode/decode engine.
// Fully self-contained, no Node/Buffer dependencies. Runs in browsers only.

import type { Charset, DecodeResult, DecodeOptions, EncodeOptions, EncodeResult, Newline, Variant, WrapMode } from '../types';
import { charsetEncode, charsetDecode } from './charset';

const STD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const MIME_WRAP = 76;
const NEWLINE_LF = '\n';
const NEWLINE_CRLF = '\r\n';

export function newlineString(newline: Newline): string {
  return newline === 'crlf' ? NEWLINE_CRLF : NEWLINE_LF;
}

export function alphabetFor(variant: Variant): string {
  return variant === 'url-safe' ? URL_ALPHABET : STD_ALPHABET;
}

export function encodeBytes(bytes: Uint8Array, variant: Variant): string {
  const table = alphabetFor(variant);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;

    out += table[b0 >> 2];
    out += table[((b0 & 0x03) << 4) | (hasB1 ? b1 >> 4 : 0)];

    if (hasB1) {
      out += table[((b1 & 0x0f) << 2) | (hasB2 ? b2 >> 6 : 0)];
    } else {
      out += variant === 'standard' ? '=' : '';
    }

    if (hasB2) {
      out += table[b2 & 0x3f];
    } else {
      out += variant === 'standard' ? '=' : '';
    }
  }
  return out;
}

export function decodeBytesToBase64(bytes: Uint8Array, variant: Variant): string {
  return encodeBytes(bytes, variant);
}

export interface DecodeValidation {
  ok: boolean;
  error?: string;
  cleaned: string;
  variant: Variant;
  padChars: number;
}

export function validateBase64(
  raw: string,
  options: { strict?: boolean; variant?: Variant; autoDetect?: boolean }
): DecodeValidation {
  let s = raw.replace(/\s/g, '');
  const strict = options.strict ?? true;
  const variant = options.variant ?? 'standard';
  const autoDetect = options.autoDetect ?? true;

  if (s.length === 0) {
    return { ok: false, error: 'Input is empty.', cleaned: '', variant, padChars: 0 };
  }

  let detectedVariant = variant;
  if (autoDetect) {
    const hasUrlSafe = /[-_]/.test(s);
    const hasStandardSpecial = /[+\/]/.test(s);
    if (hasUrlSafe && !hasStandardSpecial) detectedVariant = 'url-safe';
    else if (hasStandardSpecial && !hasUrlSafe) detectedVariant = 'standard';
  }

  const alphabet = alphabetFor(detectedVariant);
  const allAllowed = STD_ALPHABET + URL_ALPHABET + '=';

  for (const ch of s) {
    if (!allAllowed.includes(ch)) {
      return { ok: false, error: `Invalid character '${ch}' for ${detectedVariant} Base64.`, cleaned: s, variant: detectedVariant, padChars: 0 };
    }
  }

  const padIndex = s.indexOf('=');
  let padChars = 0;
  if (padIndex !== -1) {
    padChars = s.length - padIndex;
    if (padChars > 2) {
      return { ok: false, error: 'Too many padding characters.', cleaned: s, variant: detectedVariant, padChars };
    }
    for (let i = padIndex; i < s.length; i++) {
      if (s[i] !== '=') {
        return { ok: false, error: 'Padding found in the middle of the input.', cleaned: s, variant: detectedVariant, padChars };
      }
    }
    // URL-safe output must never contain padding.
    if (detectedVariant === 'url-safe') {
      return { ok: false, error: 'URL-safe Base64 must not contain padding.', cleaned: s, variant: detectedVariant, padChars };
    }
  }

  const dataPart = padIndex === -1 ? s : s.slice(0, padIndex);
  if (dataPart.length % 4 === 1) {
    return { ok: false, error: 'Invalid Base64 length.', cleaned: s, variant: detectedVariant, padChars };
  }

  if (strict && padChars > 0) {
    const lastDataChar = dataPart[dataPart.length - 1];
    const value = alphabet.indexOf(lastDataChar);
    const extraBits = padChars === 1 ? value & 0x03 : value & 0x0f;
    if (extraBits !== 0) {
      return { ok: false, error: 'Invalid Base64: non-zero pad bits.', cleaned: s, variant: detectedVariant, padChars };
    }
  }

  return { ok: true, cleaned: dataPart, variant: detectedVariant, padChars };
}

export function base64ToBytes(dataPart: string, alphabet: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of dataPart) {
    const value = alphabet.indexOf(ch);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function decodeBase64ToBytes(raw: string, options: DecodeOptions): DecodeResult {
  const validation = validateBase64(raw, {
    strict: options.strict,
    variant: options.variant,
    autoDetect: options.autoDetect,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.error!, detectedVariant: validation.variant };
  }

  const bytes = base64ToBytes(validation.cleaned, alphabetFor(validation.variant));
  return { ok: true, bytes, detectedVariant: validation.variant, warnings: [] };
}

export function wrapBase64(text: string, mode: WrapMode, newline: Newline): string {
  if (mode !== 'mime76' || text.length <= MIME_WRAP) return text;
  const sep = newlineString(newline);
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MIME_WRAP) {
    chunks.push(text.slice(i, i + MIME_WRAP));
  }
  return chunks.join(sep);
}

export function normalizeNewlines(text: string, newline: Newline): string {
  const sep = newlineString(newline);
  return text.replace(/\r\n|\r|\n/g, sep);
}

/**
 * Encode plain text to Base64 using the selected charset, variant, wrapping, etc.
 */
export function encodeTextToBase64(text: string, options: EncodeOptions): EncodeResult {
  const { charset, newline, wrap, perLine } = options;

  const encodeLine = (line: string): string => {
    let bytes: Uint8Array;
    try {
      bytes = encodeStringToBytes(line, charset);
    } catch (e) {
      throw new Error(`Character encoding failed (${charset}): ${(e as Error).message}`);
    }
    return encodeBytes(bytes, options.variant);
  };

  let encoded: string;
  try {
    if (perLine) {
      // Split on actual line boundaries present in the input, encode each independently.
      const lines = text.split(/\r\n|\r|\n/);
      encoded = lines.map(encodeLine).join(newlineString(newline));
    } else {
      encoded = encodeLine(text);
      if (wrap === 'mime76') {
        encoded = wrapBase64(encoded, wrap, newline);
      }
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return { ok: true, text: encoded, bytes: encodeStringToBytes(text, charset), warnings: [] };
}

/**
 * Decode a Base64 string back to raw bytes.
 */
export function decodeBase64(raw: string, options: DecodeOptions): DecodeResult {
  return decodeBase64ToBytes(raw, options);
}

/**
 * Convert raw bytes back to text using the selected charset.
 */
export function bytesToText(bytes: Uint8Array, charset: Charset): { ok: true; text: string } | { ok: false; error: string } {
  try {
    const text = decodeBytesToString(bytes, charset);
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: `Decoding to ${charset} failed: ${(e as Error).message}` };
  }
}

// ----- charset helpers (implemented in core/charset.ts) -----
export function encodeStringToBytes(text: string, charset: Charset): Uint8Array {
  return charsetEncode(text, charset);
}

export function decodeBytesToString(bytes: Uint8Array, charset: Charset): string {
  return charsetDecode(bytes, charset);
}