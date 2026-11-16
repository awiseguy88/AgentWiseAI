import { describe, expect, it } from 'vitest';
import { applySymbolicExpression, defaultCreationMode } from '../src/core/expression';
import { modeToState, toOctal } from '../src/core/permissions';

describe('symbolic expressions and umask (AT-10..AT-12)', () => {
  it('AT-10: Start 644, u+x -> result 744 (u+x only touches owner; matches demo step 5 semantics)', () => {
    const r = applySymbolicExpression(0o644, 'u+x', '022', 'file');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode & 0o777).toBe(0o744);
  });

  it('AT-11: a=rX on file gives execute only where already present? 644 file -> 755? depends', () => {
    // Start 644 file, a=rX: r set for all, X sets execute if dir or any execute bit set in original
    // original 644 has owner execute? no, group/other execute? no -> X gives no execute => 644? wait: X: "execute/search only if the file is a directory or any of the execute/search bits are set in the original (unmodified) mode"
    // 644: no execute bits set, file -> remains 644
    const rFile = applySymbolicExpression(0o644, 'a=rX', null, 'file');
    expect(rFile.ok).toBe(true);
    if (!rFile.ok) return;
    // a=r => 444, X condition false on file with no exec -> 444? actually a=rX sets r and X (conditional) for all
    expect(toOctal(modeToState(rFile.mode, 'file'))).toBe('444');

    const rDir = applySymbolicExpression(0o644, 'a=rX', null, 'directory');
    expect(rDir.ok).toBe(true);
    if (!rDir.ok) return;
    expect(toOctal(modeToState(rDir.mode, 'directory'))).toBe('555');
  });

  it('AT-11b: a=rX on file with execute bit set adds execute to all', () => {
    const r = applySymbolicExpression(0o744, 'a=rX', null, 'file');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // owner had execute -> X applies to all
    expect(toOctal(modeToState(r.mode, 'file'))).toBe('555');
  });

  it('AT-12: Start 666, =rw, umask 022 -> POSIX umask masking', () => {
    const r = applySymbolicExpression(0o666, 'a=rw', '022', 'file');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // a=rw with umask 022: (666 & ~022 style per-class) -> 644
    expect(r.mode & 0o777).toBe(0o644);
  });

  it('go-w removes group/other write', () => {
    const r = applySymbolicExpression(0o777, 'go-w', null, 'file');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(toOctal(modeToState(r.mode, 'file'))).toBe('755');
  });

  it('umask defaults', () => {
    expect(defaultCreationMode('file', 0o022)).toBe(0o644);
    expect(defaultCreationMode('directory', 0o022)).toBe(0o755);
  });

  it('invalid expression returns error', () => {
    const r = applySymbolicExpression(0o755, 'bogus', null, 'file');
    expect(r.ok).toBe(false);
  });
});
