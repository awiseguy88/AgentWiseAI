export const DEFAULT_QUALITY = 80;
export const MIN_QUALITY = 1;
export const MAX_QUALITY = 100;
export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const COMPRESSED_SUFFIX = '-compressed';

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export function isSupportedType(type: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(type.toLowerCase());
}

export function isJpegType(type: string): boolean {
  return type.toLowerCase() === 'image/jpeg';
}

export function clampQuality(value: number): number {
  return Math.min(Math.max(Math.trunc(value), MIN_QUALITY), MAX_QUALITY);
}

export function stem(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

export function compressedName(originalName: string, ext: string): string {
  return `${stem(originalName)}${COMPRESSED_SUFFIX}.${ext}`;
}