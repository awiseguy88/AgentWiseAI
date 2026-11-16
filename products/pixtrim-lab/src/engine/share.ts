import type { Settings } from './settings';
import { DEFAULT_SETTINGS } from './settings';

function encodeSettings(s: Settings): string {
  const json = JSON.stringify({
    w: s.width,
    h: s.height,
    r: s.ratioLocked ? 1 : 0,
    m: s.mode,
    f: s.format,
    q: s.quality,
    p: s.pattern,
    c: s.customPattern,
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
      width: typeof obj.w === 'number' ? obj.w : DEFAULT_SETTINGS.width,
      height: typeof obj.h === 'number' ? obj.h : DEFAULT_SETTINGS.height,
      ratioLocked: obj.r === 1 || obj.r === true,
      mode: obj.m || DEFAULT_SETTINGS.mode,
      format: obj.f || DEFAULT_SETTINGS.format,
      quality: typeof obj.q === 'number' ? obj.q : DEFAULT_SETTINGS.quality,
      pattern: obj.p || DEFAULT_SETTINGS.pattern,
      customPattern: typeof obj.c === 'string' ? obj.c : DEFAULT_SETTINGS.customPattern,
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
