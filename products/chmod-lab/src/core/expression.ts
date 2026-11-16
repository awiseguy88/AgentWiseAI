import { digitToTriad, triadToDigit } from './permissions';

export type ExpressionApplyResult = {
  ok: true;
  mode: number;
} | {
  ok: false;
  error: string;
};

function parseOctal3(input: string): number | null {
  const s = input.trim();
  if (!/^[0-7]{1,4}$/.test(s)) return null;
  return parseInt(s, 8) & 0o7777;
}

function whoMask(who: string): { owner: boolean; group: boolean; other: boolean } {
  const m = { owner: false, group: false, other: false };
  if (who === '' || who.includes('a')) { m.owner = m.group = m.other = true; return m; }
  if (who.includes('u')) m.owner = true;
  if (who.includes('g')) m.group = true;
  if (who.includes('o')) m.other = true;
  return m;
}

function applyOp(current: number, op: '+' | '-' | '=', perms: string, who: { owner: boolean; group: boolean; other: boolean }, isDir: boolean): number {
  const classes: Array<{ shift: number; which: keyof typeof who }> = [
    { shift: 6, which: 'owner' },
    { shift: 3, which: 'group' },
    { shift: 0, which: 'other' },
  ];
  let out = current;
  const wantR = perms.includes('r');
  const wantW = perms.includes('w');
  const wantX = perms.includes('x');
  const wantXcond = perms.includes('X');
  const wantS = perms.includes('s');
  const wantT = perms.includes('t');

  for (const c of classes) {
    if (!who[c.which]) continue;
    let digit = (out >> c.shift) & 7;
    const tri = digitToTriad(digit);
    const affectX = wantX || (wantXcond && (isDir || ((out >> 6) & 1) !== 0 || ((out >> 3) & 1) !== 0 || (out & 1) !== 0));
    if (op === '=') {
      tri.read = wantR;
      tri.write = wantW;
      tri.execute = affectX;
      // In '=' with 's'/'t' specified, set them; if not specified, clear for targeted special scope
    } else if (op === '+') {
      if (wantR) tri.read = true;
      if (wantW) tri.write = true;
      if (affectX) tri.execute = true;
    } else { // '-'
      if (wantR) tri.read = false;
      if (wantW) tri.write = false;
      if (wantX || wantXcond) tri.execute = false;
    }
    digit = triadToDigit(tri);
    out = (out & ~(7 << c.shift)) | (digit << c.shift);

    // specials
    if (c.which === 'owner') {
      if (wantS) {
        if (op === '+') out |= 0o4000;
        else if (op === '-') out &= ~0o4000;
        else out |= 0o4000; // '=' with s
      } else if (op === '=') {
        // '=' clears unspecified special for targeted who? POSIX: chmod = sets exactly specified; s/t only meaningful with u/g/o
      }
    }
    if (c.which === 'group') {
      if (wantS) {
        if (op === '+') out |= 0o2000;
        else if (op === '-') out &= ~0o2000;
        else out |= 0o2000;
      } else if (op === '=') {
        // leave as-is unless explicitly handling; standard '=' without s doesn't clear setgid unless target implies
      }
    }
    if (c.which === 'other') {
      if (wantT) {
        if (op === '+') out |= 0o1000;
        else if (op === '-') out &= ~0o1000;
        else out |= 0o1000;
      }
    }
  }
  // For '=' operations, unspecified rwx cleared for targeted classes already; special bits: if '=' targets u and doesn't mention s, clear setuid? POSIX: "perm symbol s is only meaningful with u and g"; "the effect ... is unspecified" in some cases, but common behavior: '=' sets exact listed; omitting s clears when u in who.
  // Implement common explicit behavior:
  if (op === '=') {
    if (who.owner && !wantS) out &= ~0o4000;
    if (who.group && !wantS) out &= ~0o2000;
    if (who.other && !wantT) out &= ~0o1000;
  }
  return out & 0o7777;
}

/**
 * Apply a symbolic expression like "u+x", "go-w", "a=rX", "u=rwxs".
 * When umask is provided, applies POSIX masking for '=' assignments: result bits are
 * (explicit & ~umask) for classes targeted, but special handling: 'X' uses directory/execute condition.
 * For '+/-' umask is not used (normal chmod behavior).
 */
export function applySymbolicExpression(
  startMode: number,
  expr: string,
  umask: string | null | undefined,
  kind: 'file' | 'directory',
): ExpressionApplyResult {
  const s = expr.trim();
  if (!s) return { ok: false, error: 'Expression is empty.' };
  const clauses = s.split(',').map((c) => c.trim()).filter(Boolean);
  if (clauses.length === 0) return { ok: false, error: 'Expression is empty.' };
  let mode = startMode & 0o7777;
  const um = umask != null && umask.trim() !== '' ? parseOctal3(umask) : null;
  if (umask != null && umask.trim() !== '' && um === null) {
    return { ok: false, error: 'umask must be 1–4 octal digits (0–7).' };
  }

  for (const clause of clauses) {
    const m = clause.match(/^([ugoa]*)([+\-=])([rwxXst]*)$/);
    if (!m) return { ok: false, error: `Invalid expression clause: "${clause}".` };
    const whoStr = m[1] || 'a';
    const op = m[2] as '+' | '-' | '=';
    const perms = m[3];
    if (op !== '-' && perms === '' && !(op === '=')) {
      // allow "= " empty? rare, treat as clear
    }
    if (!/^[ugoa]*$/.test(whoStr)) return { ok: false, error: `Invalid who in "${clause}".` };
    if (!/^[rwxXst]*$/.test(perms)) return { ok: false, error: `Invalid permissions in "${clause}".` };
    // s only valid with u/g (and sometimes a implies u,g), t with o? be permissive but standard: s with u/g, t with o
    if (perms.includes('t') && /[ug]/.test(whoStr) && !/[oa]/.test(whoStr)) {
      // odd, but allow
    }
    const who = whoMask(whoStr);

    if (op === '=' && um !== null) {
      // POSIX: for symbolic modes with '=', resulting permissions are (specified & ~umask)
      // applied per affected class bits (rwx). Special bits s/t are set if specified, not masked by umask.
      let temp = mode;
      // compute target as if starting from 0 for affected classes, then mask
      for (const cls of [
        { which: 'owner' as const, shift: 6 },
        { which: 'group' as const, shift: 3 },
        { which: 'other' as const, shift: 0 },
      ]) {
        if (!who[cls.which]) continue;
        const wantR = perms.includes('r');
        const wantW = perms.includes('w');
        const wantX = perms.includes('x') || (perms.includes('X') && (kind === 'directory' || ((mode >> 6) & 1) !== 0 || ((mode >> 3) & 1) !== 0 || (mode & 1) !== 0));
        let digit = (wantR ? 4 : 0) + (wantW ? 2 : 0) + (wantX ? 1 : 0);
        const umDigit = (um >> cls.shift) & 7;
        digit = digit & ~umDigit;
        temp = (temp & ~(7 << cls.shift)) | (digit << cls.shift);
      }
      // specials for '='
      if (who.owner) temp = perms.includes('s') ? (temp | 0o4000) : (temp & ~0o4000);
      if (who.group) temp = perms.includes('s') ? (temp | 0o2000) : (temp & ~0o2000);
      if (who.other) temp = perms.includes('t') ? (temp | 0o1000) : (temp & ~0o1000);
      mode = temp & 0o7777;
    } else {
      mode = applyOp(mode, op, perms, who, kind === 'directory');
    }
  }

  return { ok: true, mode };
}

export function parseUmask(input: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = input.trim();
  if (s === '') return { ok: true, value: 0o022 };
  if (!/^[0-7]{1,4}$/.test(s)) return { ok: false, error: 'umask must be 1–4 octal digits (0–7).' };
  return { ok: true, value: parseInt(s, 8) & 0o777 };
}

export function defaultCreationMode(kind: 'file' | 'directory', umask: number): number {
  const base = kind === 'directory' ? 0o777 : 0o666;
  return base & ~umask & 0o777;
}
