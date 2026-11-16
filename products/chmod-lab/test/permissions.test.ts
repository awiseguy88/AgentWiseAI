import { describe, expect, it } from 'vitest';
import {
  computeWarnings,
  modeToState,
  parseOctalInput,
  parseSymbolicInput,
  toFourDigitOctal,
  toLsL,
  toOctal,
  toSymbolic,
} from '../src/core/permissions';

describe('permissions conversions (AT-01..AT-09)', () => {
  it('AT-01: grid 755 -> octal/symbolic/description', () => {
    const s = modeToState(0o755, 'file');
    expect(toOctal(s)).toBe('755');
    expect(toSymbolic(s)).toBe('rwxr-xr-x');
    expect(toLsL(s)).toBe('-rwxr-xr-x');
    expect(s.owner.read && s.owner.write && s.owner.execute).toBe(true);
    expect(s.group.read && !s.group.write && s.group.execute).toBe(true);
    expect(s.other.read && !s.other.write && s.other.execute).toBe(true);
  });

  it('AT-02: Directory toggle changes ls-l prefix', () => {
    const s = modeToState(0o755, 'directory');
    expect(toLsL(s)).toBe('drwxr-xr-x');
  });

  it('AT-03: Setuid -> four-digit 4755 and symbolic rwsr-xr-x', () => {
    const s = modeToState(0o4755, 'file');
    expect(toFourDigitOctal(s)).toBe('4755');
    expect(toSymbolic(s)).toBe('rwsr-xr-x');
    expect(s.setuid).toBe(true);
  });

  it('AT-04: Octal 644 -> grid and symbolic', () => {
    const r = parseOctalInput('644');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = modeToState(r.mode, 'file');
    expect(s.owner.read && s.owner.write && !s.owner.execute).toBe(true);
    expect(s.group.read && !s.group.write && !s.group.execute).toBe(true);
    expect(s.other.read && !s.other.write && !s.other.execute).toBe(true);
    expect(toSymbolic(s)).toBe('rw-r--r--');
  });

  it('AT-05: Octal 4755 -> four-digit shown, setuid checked', () => {
    const r = parseOctalInput('4755');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = modeToState(r.mode, 'file');
    expect(toFourDigitOctal(s)).toBe('4755');
    expect(s.setuid).toBe(true);
  });

  it('AT-06: Invalid octal 999 -> error', () => {
    const r = parseOctalInput('999');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(0);
  });

  it('AT-07: Symbolic rwxr-xr-x -> octal 755', () => {
    const r = parseSymbolicInput('rwxr-xr-x');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = modeToState(r.mode, 'file');
    expect(toOctal(s)).toBe('755');
  });

  it('AT-08: Symbolic -rwsr-x--x. -> octal 4751, setuid checked', () => {
    const r = parseSymbolicInput('-rwsr-x--x.');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = modeToState(r.mode, 'file');
    expect(toOctal(s)).toBe('751');
    expect(toFourDigitOctal(s)).toBe('4751');
    expect(s.setuid).toBe(true);
  });

  it('AT-09: Symbolic rwx (6 chars) -> error', () => {
    const r = parseSymbolicInput('rwx');
    expect(r.ok).toBe(false);
  });

  it('Warnings: world-writable and risky setuid combos', () => {
    const ww = modeToState(0o777, 'file');
    expect(computeWarnings(ww).some((w) => w.id === 'world-writable')).toBe(true);
    const suNoExec = modeToState(0o4644, 'file');
    expect(computeWarnings(suNoExec).some((w) => w.id === 'setuid-no-exec')).toBe(true);
    const stickyFile = modeToState(0o1644, 'file');
    expect(computeWarnings(stickyFile).some((w) => w.id === 'sticky-file')).toBe(true);
  });
});
