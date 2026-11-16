export type FilenamePattern = 'pixtrim' | 'original_resized' | 'custom' | 'original';

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function extFor(format: string, originalName: string): string {
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
  format: string,
  custom?: string
): string {
  const ext = extFor(format, originalName);
  const base = baseName(originalName);
  const customName = (custom || 'image').replace(/[^\w.-]+/g, '_');
  switch (pattern) {
    case 'pixtrim':
      return `pixtrim_${pad3(index)}.${ext}`;
    case 'original_resized':
      return `${base}_resized.${ext}`;
    case 'custom':
      return `${customName}_${pad3(index)}.${ext}`;
    case 'original':
      return `${base}.${ext}`;
    default:
      return `pixtrim_${pad3(index)}.${ext}`;
  }
}
