import type { Settings } from './types.ts';

export const STORAGE_KEY = 'fitframe.settings.v1';

export function loadSettings(defaults: Settings): Settings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return mergeSettings(defaults, parsed);
  } catch {
    return defaults;
  }
}

export function mergeSettings(base: Settings, patch: Partial<Settings>): Settings {
  return {
    ...base,
    ...patch,
    watermark: { ...base.watermark, ...(patch.watermark ?? {}) },
    border: { ...base.border, ...(patch.border ?? {}) },
    ai: { ...base.ai, ...(patch.ai ?? {}) },
  };
}

export function saveSettings(settings: Settings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const { watermark, border, ai, ...rest } = settings;
    const toStore: Partial<Settings> = {
      ...rest,
      watermark: { ...watermark, imageDataUrl: null }, // don't persist image payloads
      border,
      ai,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // ignore storage quota / privacy errors
  }
}