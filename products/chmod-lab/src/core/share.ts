import type { PermissionState } from '../types';
import { modeToState } from './permissions';

export type SharedState = {
  mode: number;
  kind: 'file' | 'directory';
  expression: string;
};

export function encodeSharedState(mode: number, kind: 'file' | 'directory', expression: string): string {
  const state: SharedState = { mode: mode & 0o7777, kind, expression };
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

export function decodeSharedState(hash: string): SharedState | null {
  try {
    let s = hash.replace(/^#/, '').replace(/^chmod-/, '');
    if (!s) return null;
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (typeof parsed.mode !== 'number' || parsed.mode < 0 || parsed.mode > 0o7777) return null;
    const kind = parsed.kind === 'directory' ? 'directory' : 'file';
    const expression = typeof parsed.expression === 'string' ? parsed.expression.slice(0, 200) : '';
    return { mode: parsed.mode, kind, expression };
  } catch {
    return null;
  }
}

export function sharedStateToPermission(state: SharedState): PermissionState {
  return modeToState(state.mode, state.kind);
}