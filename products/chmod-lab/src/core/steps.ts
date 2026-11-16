import type { PermissionState } from '../types';
import { specialDigit, triadToDigit } from './permissions';

export function calculationSteps(state: PermissionState): string[] {
  const o = triadToDigit(state.owner);
  const g = triadToDigit(state.group);
  const t = triadToDigit(state.other);
  const s = specialDigit(state);
  const owner = `${state.owner.read ? '4 (r) + ' : ''}${state.owner.write ? '2 (w) + ' : ''}${state.owner.execute ? '1 (x) + ' : ''}`.replace(/ \+ $/, '');
  const group = `${state.group.read ? '4 (r) + ' : ''}${state.group.write ? '2 (w) + ' : ''}${state.group.execute ? '1 (x) + ' : ''}`.replace(/ \+ $/, '');
  const other = `${state.other.read ? '4 (r) + ' : ''}${state.other.write ? '2 (w) + ' : ''}${state.other.execute ? '1 (x) + ' : ''}`.replace(/ \+ $/, '');
  const steps: string[] = [];
  steps.push(`Owner digit = ${owner || '0'} = ${o}`);
  steps.push(`Group digit = ${group || '0'} = ${g}`);
  steps.push(`Other digit = ${other || '0'} = ${t}`);
  const specialParts = [state.setuid ? '4 (setuid)' : '', state.setgid ? '2 (setgid)' : '', state.sticky ? '1 (sticky)' : ''].filter(Boolean);
  steps.push(`Special digit = ${specialParts.length ? specialParts.join(' + ') : '0'} = ${s}`);
  steps.push(`Four-digit octal = ${s}${o}${g}${t}`);
  return steps;
}

export function umaskFormula(kind: 'file' | 'directory', umask: string): { label: string; value: string } {
  const um = parseInt(umask || '022', 8);
  const base = kind === 'directory' ? 0o777 : 0o666;
  const result = base & ~um;
  const baseStr = kind === 'directory' ? '777' : '666';
  return {
    label: kind === 'directory' ? 'New directory (777 AND NOT umask)' : 'New file (666 AND NOT umask)',
    value: `${baseStr} & ~${umask.padStart(3, '0')} = ${result.toString(8).padStart(3, '0')}`,
  };
}