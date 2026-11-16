import { describe, expect, it } from 'vitest';
import { decodeSharedState, encodeSharedState } from '../src/core/share';
import { modeToState, toMode } from '../src/core/permissions';
import { FIXTURES } from '../src/fixtures';

describe('share and fixtures', () => {
  it('encode/decode shared state round-trips', () => {
    const hash = encodeSharedState(0o750, 'directory', 'go-w');
    const decoded = decodeSharedState(hash);
    expect(decoded).not.toBeNull();
    expect(decoded?.mode).toBe(0o750);
    expect(decoded?.kind).toBe('directory');
    expect(decoded?.expression).toBe('go-w');
  });

  it('decode invalid hash returns null', () => {
    expect(decodeSharedState('!!!')).toBeNull();
  });

  it('fixtures are programmatically defined', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(3);
    for (const f of FIXTURES) {
      const s = modeToState(f.mode, f.kind);
      expect(toMode(s)).toBe(f.mode & 0o7777);
    }
  });

  it('AT-15 semantics: mode/kind/expression preserved', () => {
    const hash = encodeSharedState(0o750, 'directory', '');
    const d = decodeSharedState(hash);
    expect(d?.mode).toBe(0o750);
    expect(d?.kind).toBe('directory');
  });
});
