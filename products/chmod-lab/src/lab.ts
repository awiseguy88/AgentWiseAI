import type { PermissionState, Warning } from './types';
import {
  defaultState,
  modeToState,
  toFourDigitOctal,
  toLsL,
  toMode,
  toOctal,
  toSymbolic,
} from './core/permissions';
import { parseOctalInput, parseSymbolicInput } from './core/permissions';
import { applySymbolicExpression, defaultCreationMode } from './core/expression';
import { chmodDirectoryFindCommand, chmodOctalCommand, chmodSymbolicArg, chmodSymbolicCommand } from './core/commands';
import { calculationSteps, umaskFormula } from './core/steps';
import { describeState } from './core/permissions';
import { computeWarnings } from './core/permissions';

export class ChmodLab {
  state: PermissionState = defaultState();
  umask: string = '022';
  expression: string = '';
  error: string = '';
  warnings: Warning[] = [];
  history: PermissionState[] = [];

  constructor() {
    this.state = defaultState();
    this.warnings = computeWarnings(this.state);
  }

  setState(partial: Partial<PermissionState>): void {
    this.state = { ...this.state, ...partial };
    this.warnings = computeWarnings(this.state);
  }

  setModeFromOctal(input: string): { ok: boolean; error?: string } {
    const r = parseOctalInput(input);
    if (!r.ok) { this.error = r.error; return { ok: false, error: r.error }; }
    this.state = modeToState(r.mode, this.state.kind);
    this.error = '';
    this.warnings = computeWarnings(this.state);
    return { ok: true };
  }

  setModeFromSymbolic(input: string): { ok: boolean; error?: string } {
    const r = parseSymbolicInput(input);
    if (!r.ok) { this.error = r.error; return { ok: false, error: r.error }; }
    this.state = modeToState(r.mode, this.state.kind);
    this.error = '';
    this.warnings = computeWarnings(this.state);
    return { ok: true };
  }

  applyExpression(expr: string, kind: 'file' | 'directory'): { ok: boolean; error?: string } {
    const r = applySymbolicExpression(toMode(this.state), expr, this.umask, kind);
    if (!r.ok) { this.error = r.error; return { ok: false, error: r.error }; }
    this.state = modeToState(r.mode, kind);
    this.expression = expr;
    this.error = '';
    this.warnings = computeWarnings(this.state);
    return { ok: true };
  }

  setKind(kind: 'file' | 'directory'): void {
    this.state = { ...this.state, kind };
    this.warnings = computeWarnings(this.state);
  }

  toggleBit(classKey: 'owner' | 'group' | 'other', bit: 'read' | 'write' | 'execute'): void {
    const triad = this.state[classKey];
    this.state = {
      ...this.state,
      [classKey]: { ...triad, [bit]: !triad[bit] },
    };
    this.warnings = computeWarnings(this.state);
  }

  setSpecial(name: 'setuid' | 'setgid' | 'sticky', value: boolean): void {
    this.state = { ...this.state, [name]: value };
    this.warnings = computeWarnings(this.state);
  }

  clearError(): void { this.error = ''; }

  get octal(): string { return toOctal(this.state); }
  get fourDigit(): string { return toFourDigitOctal(this.state); }
  get symbolic(): string { return toSymbolic(this.state); }
  get lsL(): string { return toLsL(this.state); }
  get description(): string[] { return describeState(this.state); }
  get steps(): string[] { return calculationSteps(this.state); }
  get umaskDefault(): { label: string; value: string } { return umaskFormula(this.state.kind, this.umask); }
  get commands(): { octal: string; symbolic: string; find: string | null } {
    return {
      octal: chmodOctalCommand(this.state, 'file'),
      symbolic: chmodSymbolicCommand(this.state, 'file'),
      find: this.state.kind === 'directory' ? chmodDirectoryFindCommand(this.state, 'dir') : null,
    };
  }
  get symbolicArg(): string { return chmodSymbolicArg(this.state); }
  get creationMode(): string { return defaultCreationMode(this.state.kind, parseInt(this.umask || '022', 8)).toString(8).padStart(3, '0'); }

  pushToHistory(): void {
    this.history = [this.state, ...this.history].slice(0, 10);
  }
}

export function labFromStored(stored: { mode: number; kind: 'file' | 'directory'; expression: string; umask: string }): ChmodLab {
  const lab = new ChmodLab();
  lab.state = modeToState(stored.mode, stored.kind);
  lab.umask = stored.umask || '022';
  lab.expression = stored.expression || '';
  lab.warnings = computeWarnings(lab.state);
  return lab;
}