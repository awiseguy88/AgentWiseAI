import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  targetWidth: 0,
  targetHeight: 0,
  ratioLocked: true,
  resizeMode: 'contain',
  outputFormat: 'original',
  quality: 90,
  filenamePattern: 'pictura_xxx',
  customName: 'image',
  theme: 'light',
};

const STORAGE_KEY = 'picturabox-settings-v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable — ignore
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}