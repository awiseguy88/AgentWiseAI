export type Triad = {
  read: boolean;
  write: boolean;
  execute: boolean;
};

export type PermissionState = {
  owner: Triad;
  group: Triad;
  other: Triad;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
  kind: 'file' | 'directory';
};

export type Warning = {
  id: string;
  message: string;
};

export type ValidationResult = {
  ok: true;
  state: Partial<PermissionState>;
} | {
  ok: false;
  error: string;
};

export type ExpressionResult = {
  ok: true;
  mode: number; // 0..0o7777
  symbolic: string;
  octal: string;
} | {
  ok: false;
  error: string;
};
