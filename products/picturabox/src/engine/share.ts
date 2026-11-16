import type { Settings } from './types';
import { DEFAULT_SETTINGS } from './settings';

function encodeSettings(s: Settings): string {
  const json = JSON.stringify({
    w: s.targetWidth,
    h: s.targetHeight,
    r: s.ratioLocked ? 1 : 0,
    m: s.resizeMode,
    f: s.outputFormat,
    q: s.quality,
    p: s.filenamePattern,
    c: s.customName,
    t: s.theme,
  });
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSettingsHash(hash: string): Partial<Settings> | null {
  try {
    const raw = hash.replace(/^#/, '').trim();
    if (!raw.startsWith('s=')) return null;
    const encoded = raw.slice(2);
    const json = decodeURIComponent(escape(atob(encoded)));
    const obj = JSON.parse(json);
    return {
      targetWidth: typeof obj.w === 'number' ? obj.w : DEFAULT_SETTINGS.targetWidth,
      targetHeight: typeof obj.h === 'number' ? obj.h : DEFAULT_SETTINGS.targetHeight,
      ratioLocked: obj.r === 1 || obj.r === true,
      resizeMode: obj.m || DEFAULT_SETTINGS.resizeMode,
      outputFormat: obj.f || DEFAULT_SETTINGS.outputFormat,
      quality: typeof obj.q === 'number' ? obj.q : DEFAULT_SETTINGS.quality,
      filenamePattern: obj.p || DEFAULT_SETTINGS.filenamePattern,
      customName: typeof obj.c === 'string' ? obj.c : DEFAULT_SETTINGS.customName,
      theme: obj.t || DEFAULT_SETTINGS.theme,
    };
  } catch {
    return null;
  }
}

export function encodeSettingsHash(s: Settings): string {
  return `#s=${encodeSettings(s)}`;
}

export function settingsFromHash(): Partial<Settings> | null {
  if (typeof location === 'undefined') return null;
  return decodeSettingsHash(location.hash);
}