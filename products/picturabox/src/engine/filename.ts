import type { FilenamePattern, OutputFormat } from './types';

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

export function extFor(format: OutputFormat, originalName: string): string {
  if (format === 'jpeg') return 'jpg';
  if (format === 'webp') return 'webp';
  if (format === 'png') return 'png';
  if (format === 'avif') return 'avif';
  if (format === 'original') {
    const e = (originalName.split('.').pop() || 'png').toLowerCase();
    return e === 'jpeg' ? 'jpg' : e;
  }
  return 'png';
}

export function buildFilename(
  pattern: FilenamePattern,
  originalName: string,
  index: number,
  format: OutputFormat,
  custom?: string
): string {
  const ext = extFor(format, originalName);
  const base = baseName(originalName);
  const customName = (custom || 'image').replace(/[^\w.-]+/g, '_');
  switch (pattern) {
    case 'pictura_xxx':
      return `pictura_${pad3(index)}.${ext}`;
    case 'original_resized':
      return `${base}_resized.${ext}`;
    case 'custom_{name}':
      return `${customName}_${pad3(index)}.${ext}`;
    case 'original':
      return `${base}.${ext}`;
    default:
      return `pictura_${pad3(index)}.${ext}`;
  }
}