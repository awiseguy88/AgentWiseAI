export interface RenameOptions {
  pattern: string;
  start: number;
  index: number; // 0-based in batch
  originalName: string; // filename without extension
  ext: string; // without dot
}

export function padSequential(n: number): string {
  const s = String(n);
  return s.length >= 3 ? s : s.padStart(3, '0');
}

export function applyRenamePattern(opts: RenameOptions): string {
  const seq = padSequential(opts.start + opts.index);
  const base = (opts.pattern || 'xxx')
    .replace(/ORIGINAL-NAME/g, opts.originalName)
    .replace(/xxx/g, seq);
  const clean = base.replace(/[\\/:*?"<>|]+/g, '_').trim() || seq;
  return `${clean}.${opts.ext}`;
}

export function splitName(filename: string): { base: string; ext: string } {
  const i = filename.lastIndexOf('.');
  if (i <= 0) return { base: filename, ext: '' };
  return { base: filename.slice(0, i), ext: filename.slice(i + 1) };
}
