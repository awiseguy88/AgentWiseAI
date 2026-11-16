export type ResizeMode = 'exact' | 'contain' | 'cover' | 'percentage';
export type OutputFormat = 'original' | 'jpeg' | 'webp' | 'png' | 'avif';
export type FilenamePattern = 'pixtrim' | 'original_resized' | 'custom' | 'original';

export interface Settings {
  width: number;
  height: number;
  ratioLocked: boolean;
  mode: ResizeMode;
  format: OutputFormat;
  quality: number;
  pattern: FilenamePattern;
  customPattern: string;
  theme: 'light' | 'dark';
}

export const DEFAULT_SETTINGS: Settings = {
  width: 0,
  height: 0,
  ratioLocked: true,
  mode: 'contain',
  format: 'original',
  quality: 90,
  pattern: 'pixtrim',
  customPattern: 'image',
  theme: 'light',
};

const STORAGE_KEY = 'pixtrim-lab-settings';

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
