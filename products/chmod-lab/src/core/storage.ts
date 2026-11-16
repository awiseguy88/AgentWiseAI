import type { PermissionState } from '../types';
import { defaultState, modeToState } from './permissions';

const KEY = 'chmod-lab:v1';
const HISTORY_KEY = 'chmod-lab:history:v1';

export type StoredState = {
  mode: number;
  kind: 'file' | 'directory';
  expression: string;
  theme: 'light' | 'dark';
  umask: string;
};

export function loadStored(): StoredState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.mode !== 'number' || parsed.mode < 0 || parsed.mode > 0o7777) return null;
    return {
      mode: parsed.mode,
      kind: parsed.kind === 'directory' ? 'directory' : 'file',
      expression: typeof parsed.expression === 'string' ? parsed.expression : '',
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      umask: typeof parsed.umask === 'string' ? parsed.umask : '022',
    };
  } catch {
    return null;
  }
}

export function saveStored(state: StoredState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function loadHistory(): PermissionState[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 10).map((m) => modeToState(Number(m) & 0o7777, 'file'));
  } catch {
    return [];
  }
}

export function pushHistory(state: PermissionState): PermissionState[] {
  if (typeof localStorage === 'undefined') return [];
  const history = loadHistory();
  const mode = (modeToState((state.owner.read ? 4 : 0) + (state.owner.write ? 2 : 0) + (state.owner.execute ? 1 : 0), state.kind).kind, state.kind);
  void mode;
  const current = toHistoryMode(state);
  const filtered = history.filter((h) => toHistoryMode(h) !== current);
  const next = [state, ...filtered].slice(0, 10);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.map(toHistoryMode)));
  } catch {
    // ignore
  }
  return next;
}

function toHistoryMode(state: PermissionState): number {
  // replicate toMode without import cycle
  const s = (state.setuid ? 4 : 0) + (state.setgid ? 2 : 0) + (state.sticky ? 1 : 0);
  const o = (state.owner.read ? 4 : 0) + (state.owner.write ? 2 : 0) + (state.owner.execute ? 1 : 0);
  const g = (state.group.read ? 4 : 0) + (state.group.write ? 2 : 0) + (state.group.execute ? 1 : 0);
  const t = (state.other.read ? 4 : 0) + (state.other.write ? 2 : 0) + (state.other.execute ? 1 : 0);
  return (s << 9) | (o << 6) | (g << 3) | t;
}

export function defaultStoredState(): StoredState {
  return { mode: 0o755, kind: 'file', expression: '', theme: 'light', umask: '022' };
}

export function restoreDefaultState(): PermissionState {
  return defaultState();
}