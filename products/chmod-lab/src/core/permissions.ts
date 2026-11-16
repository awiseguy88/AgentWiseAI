import type { PermissionState, Triad, Warning } from '../types';

export const emptyTriad = (): Triad => ({ read: false, write: false, execute: false });

export const defaultState = (): PermissionState => ({
  owner: { read: true, write: true, execute: true },
  group: { read: true, write: false, execute: true },
  other: { read: true, write: false, execute: true },
  setuid: false,
  setgid: false,
  sticky: false,
  kind: 'file',
});

export function triadToDigit(t: Triad): number {
  return (t.read ? 4 : 0) + (t.write ? 2 : 0) + (t.execute ? 1 : 0);
}

export function digitToTriad(d: number): Triad {
  if (d < 0 || d > 7 || !Number.isInteger(d)) throw new Error('Invalid triad digit');
  return {
    read: (d & 4) !== 0,
    write: (d & 2) !== 0,
    execute: (d & 1) !== 0,
  };
}

export function specialDigit(state: Pick<PermissionState, 'setuid' | 'setgid' | 'sticky'>): number {
  return (state.setuid ? 4 : 0) + (state.setgid ? 2 : 0) + (state.sticky ? 1 : 0);
}

export function toMode(state: PermissionState): number {
  const s = specialDigit(state);
  const o = triadToDigit(state.owner);
  const g = triadToDigit(state.group);
  const t = triadToDigit(state.other);
  return (s << 9) | (o << 6) | (g << 3) | t;
}

export function toOctal(state: PermissionState): string {
  return (toMode(state) & 0o777).toString(8).padStart(3, '0');
}

export function toFourDigitOctal(state: PermissionState): string {
  return toMode(state).toString(8).padStart(4, '0');
}

export function modeToState(mode: number, kind: 'file' | 'directory' = 'file'): PermissionState {
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o7777) throw new Error('Invalid mode');
  const s = (mode >> 9) & 7;
  const o = (mode >> 6) & 7;
  const g = (mode >> 3) & 7;
  const t = mode & 7;
  return {
    owner: digitToTriad(o),
    group: digitToTriad(g),
    other: digitToTriad(t),
    setuid: (s & 4) !== 0,
    setgid: (s & 2) !== 0,
    sticky: (s & 1) !== 0,
    kind,
  };
}

function triadSymbol(t: Triad, special: boolean, specialChar: 's' | 't'): string {
  const r = t.read ? 'r' : '-';
  const w = t.write ? 'w' : '-';
  let x: string;
  if (special) x = t.execute ? specialChar : specialChar.toUpperCase();
  else x = t.execute ? 'x' : '-';
  return r + w + x;
}

export function toSymbolic(state: PermissionState): string {
  return (
    triadSymbol(state.owner, state.setuid, 's') +
    triadSymbol(state.group, state.setgid, 's') +
    triadSymbol(state.other, state.sticky, 't')
  );
}

export function toLsL(state: PermissionState): string {
  const prefix = state.kind === 'directory' ? 'd' : '-';
  return prefix + toSymbolic(state);
}

export function parseOctalInput(input: string): { ok: true; mode: number } | { ok: false; error: string } {
  const s = input.trim();
  if (!/^[0-7]{1,4}$/.test(s)) {
    return { ok: false, error: 'Octal mode must be 1–4 octal digits (0–7).' };
  }
  const mode = parseInt(s, 8);
  if (mode < 0 || mode > 0o7777) {
    return { ok: false, error: 'Octal mode out of range.' };
  }
  return { ok: true, mode };
}

export function parseSymbolicInput(input: string): { ok: true; mode: number } | { ok: false; error: string } {
  let s = input.trim();
  // Accept optional type prefix and optional trailing indicator like '.' or '+'
  if (/^[-dcbpls]/.test(s)) s = s.slice(1);
  if (s.length > 9) s = s.replace(/[.+@ ]+$/, '');
  if (s.length !== 9) {
    return { ok: false, error: 'Symbolic mode must be 9 characters (e.g. rwxr-xr-x).' };
  }
  const parseTriad = (chunk: string, specialKind: 's' | 't'): { triad: Triad; special: boolean } | null => {
    if (!/^[r-][w-][xsStT-]$/.test(chunk)) return null;
    const read = chunk[0] === 'r';
    const write = chunk[1] === 'w';
    const xch = chunk[2];
    let execute = false;
    let special = false;
    if (xch === 'x') { execute = true; }
    else if (xch === '-') { execute = false; }
    else if (xch === specialKind) { execute = true; special = true; }
    else if (xch === specialKind.toUpperCase()) { execute = false; special = true; }
    else return null;
    return { triad: { read, write, execute }, special };
  };
  const o = parseTriad(s.slice(0, 3), 's');
  const g = parseTriad(s.slice(3, 6), 's');
  const t = parseTriad(s.slice(6, 9), 't');
  if (!o || !g || !t) return { ok: false, error: 'Invalid symbolic mode string.' };
  const mode = (o.special ? 0o4000 : 0) + (g.special ? 0o2000 : 0) + (t.special ? 0o1000 : 0)
    + (triadToDigit(o.triad) << 6) + (triadToDigit(g.triad) << 3) + triadToDigit(t.triad);
  return { ok: true, mode };
}

export function describeTriad(name: string, t: Triad): string {
  const perms: string[] = [];
  perms.push(t.read ? 'read' : 'no read');
  perms.push(t.write ? 'write' : 'no write');
  perms.push(t.execute ? 'execute' : 'no execute');
  return `${name}: ${perms.join(', ')}`;
}

export function describeState(state: PermissionState): string[] {
  const parts = [
    describeTriad('Owner', state.owner),
    describeTriad('Group', state.group),
    describeTriad('Other', state.other),
  ];
  const specials: string[] = [];
  if (state.setuid) specials.push('setuid');
  if (state.setgid) specials.push('setgid');
  if (state.sticky) specials.push('sticky');
  if (specials.length) parts.push(`Special: ${specials.join(', ')}`);
  parts.push(`Type: ${state.kind}`);
  return parts;
}

export function computeWarnings(state: PermissionState): Warning[] {
  const warnings: Warning[] = [];
  if (state.other.write) {
    warnings.push({ id: 'world-writable', message: 'World-writable: any user can modify this file/directory.' });
  }
  if (state.setuid && !state.owner.execute) {
    warnings.push({ id: 'setuid-no-exec', message: 'Setuid is set without owner execute (shown as uppercase S); it has no effect.' });
  }
  if (state.setuid && (state.group.write || state.other.write)) {
    warnings.push({ id: 'setuid-writable', message: 'Setuid combined with group/world write is risky and may be ignored by the system.' });
  }
  if (state.sticky && state.kind === 'file') {
    warnings.push({ id: 'sticky-file', message: 'Sticky bit on a regular file has no standard effect on most systems.' });
  }
  if (state.kind === 'directory' && !state.owner.execute && state.owner.read) {
    warnings.push({ id: 'dir-read-no-exec', message: 'Directory is readable by owner but not executable; listing contents may fail without execute permission.' });
  }
  if (!state.owner.read) {
    warnings.push({ id: 'owner-unreadable', message: 'Owner cannot read this file/directory.' });
  }
  return warnings;
}

export function normalizeKind(mode: number, _kind: 'file' | 'directory'): number {
  return mode & 0o7777; // kind does not change bits, callers decide; helper for clarity
}
