import { describe, it, expect } from 'vitest';
import {
  base64urlToBytes,
  bytesToBase64url,
  stringToBase64url,
  base64urlToString,
} from '../src/crypto/base64url.js';

describe('base64url', () => {
  it('decodes standard segments to bytes', () => {
    const bytes = base64urlToBytes('SGVsbG8gV29ybGQ');
    expect(new TextDecoder().decode(bytes)).toBe('Hello World');
  });

  it('encodes bytes back to base64url without padding', () => {
    const bytes = new TextEncoder().encode('Hello World');
    expect(bytesToBase64url(bytes)).toBe('SGVsbG8gV29ybGQ');
  });

  it('stringToBase64url and base64urlToString round-trip', () => {
    const inputs = ['', 'a', 'ab', 'abc', 'abcd', '{"alg":"HS256","typ":"JWT"}', 'user-42'];
    for (const input of inputs) {
      const b64 = stringToBase64url(input);
      expect(base64urlToString(b64)).toBe(input);
    }
  });

  it('handles URL-safe alphabet (- and _)', () => {
    // bytes that would produce + and / in standard base64
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe]);
    const b64url = bytesToBase64url(bytes);
    expect(b64url).toBe('-__-');
    expect(base64urlToBytes(b64url)).toEqual(bytes);
  });

  it('throws on invalid characters', () => {
    expect(() => base64urlToBytes('!!!')).toThrow(/Invalid Base64URL/);
    expect(() => base64urlToBytes('a=b=c')).toThrow(/Invalid Base64URL/);
  });

  it('throws on length % 4 == 1', () => {
    expect(() => base64urlToBytes('abcde')).toThrow(/truncated or invalid length/);
  });

  it('handles empty string', () => {
    expect(base64urlToBytes('')).toEqual(new Uint8Array(0));
    expect(bytesToBase64url(new Uint8Array(0))).toBe('');
  });
});