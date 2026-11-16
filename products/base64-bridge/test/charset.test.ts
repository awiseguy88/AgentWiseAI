import { describe, expect, it } from 'vitest';
import { charsetEncode, charsetDecode } from '../src/core/charset';
import type { Charset } from '../src/types';

const charsets: Charset[] = ['utf-8', 'ascii', 'iso-8859-1', 'cp1252', 'utf-16-le', 'utf-16-be'];

function roundTrip(text: string, charset: Charset): { ok: true; text: string } | { ok: false; error: string } {
  const bytes = charsetEncode(text, charset);
  const decoded = charsetDecode(bytes, charset);
  return { ok: true, text: decoded };
}

describe('charset round-trips', () => {
  it('UTF-8 handles emoji and CJK', () => {
    const text = 'Hello 👋 世界';
    const r = roundTrip(text, 'utf-8');
    expect(r.ok && r.text).toBe(text);
  });

  it('UTF-16LE/BE handle surrogate pairs', () => {
    const text = 'A😀B';
    const le = roundTrip(text, 'utf-16-le');
    const be = roundTrip(text, 'utf-16-be');
    expect(le.ok && le.text).toBe(text);
    expect(be.ok && be.text).toBe(text);
  });

  it('ASCII rejects non-ASCII on encode', () => {
    expect(() => charsetEncode('café', 'ascii')).toThrow();
  });

  it('Latin-1 handles é but rejects emoji', () => {
    const ok = roundTrip('café', 'iso-8859-1');
    expect(ok.ok && ok.text).toBe('café');
    expect(() => charsetEncode('😀', 'iso-8859-1')).toThrow();
  });

  it('Windows-1252 handles euro sign', () => {
    const bytes = charsetEncode('€', 'cp1252');
    expect(bytes[0]).toBe(0x80);
    const back = charsetDecode(bytes, 'cp1252');
    expect(back).toBe('€');
  });

  it('all charsets encode ASCII subset', () => {
    const text = 'Hello, World!';
    for (const cs of charsets) {
      const r = roundTrip(text, cs);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.text).toBe(text);
    }
  });
});