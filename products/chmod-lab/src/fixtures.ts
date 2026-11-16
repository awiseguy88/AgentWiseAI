import type { PermissionState } from './types';
import { modeToState } from './core/permissions';

export type Fixture = {
  name: string;
  kind: 'file' | 'directory';
  mode: number;
  description: string;
  label: string;
};

export const FIXTURES: Fixture[] = [
  {
    name: 'Private key',
    kind: 'file',
    mode: 0o600,
    description: 'Owner read/write only. No group or other access.',
    label: 'Private key',
  },
  {
    name: 'Web page',
    kind: 'file',
    mode: 0o644,
    description: 'Owner read/write; group and other read only.',
    label: 'Web page',
  },
  {
    name: 'Script',
    kind: 'file',
    mode: 0o755,
    description: 'Owner read/write/execute; group and other read/execute.',
    label: 'Script',
  },
  {
    name: 'Project dir',
    kind: 'directory',
    mode: 0o755,
    description: 'Owner read/write/execute; group and other read/execute.',
    label: 'Project dir',
  },
  {
    name: 'Scratch dir',
    kind: 'directory',
    mode: 0o775,
    description: 'Owner and group read/write/execute; other read/execute.',
    label: 'Scratch dir',
  },
];

export function fixtureState(fixture: Fixture): PermissionState {
  return modeToState(fixture.mode, fixture.kind);
}

export function fixtureForMode(mode: number, kind: 'file' | 'directory'): Fixture | null {
  return FIXTURES.find((f) => f.mode === mode && f.kind === kind) || null;
}