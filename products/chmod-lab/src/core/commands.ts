import type { PermissionState } from '../types';
import { toFourDigitOctal, toOctal } from './permissions';

export function chmodOctalCommand(state: PermissionState, path: string): string {
  const oct = (state.setuid || state.setgid || state.sticky) ? toFourDigitOctal(state) : toOctal(state);
  return `chmod ${oct} ${path}`;
}

export function chmodSymbolicArg(state: PermissionState): string {
  // produce explicit symbolic assignment form u=...,g=...,o=...
  const part = (r: boolean, w: boolean, x: boolean, special: boolean, schar: 's' | 't') => {
    let s = '';
    if (r) s += 'r';
    if (w) s += 'w';
    if (x) s += 'x';
    if (special) s += schar;
    return s;
  };
  const u = part(state.owner.read, state.owner.write, state.owner.execute, state.setuid, 's');
  const g = part(state.group.read, state.group.write, state.group.execute, state.setgid, 's');
  const o = part(state.other.read, state.other.write, state.other.execute, state.sticky, 't');
  return `u=${u},g=${g},o=${o}`;
}

export function chmodSymbolicCommand(state: PermissionState, path: string): string {
  return `chmod ${chmodSymbolicArg(state)} ${path}`;
}

export function chmodDirectoryFindCommand(state: PermissionState, path: string): string {
  const oct = (state.setuid || state.setgid || state.sticky) ? toFourDigitOctal(state) : toOctal(state);
  return `find ${path} -type d -exec chmod ${oct} {} \\;`;
}
