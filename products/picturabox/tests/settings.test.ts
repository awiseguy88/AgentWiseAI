import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, clearSettings } from '../src/engine/settings';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('settings persistence (M4)', () => {
  beforeEach(() => mockLocalStorage.clear());

  it('M4-A1 saves and restores settings from localStorage', () => {
    const s = { ...DEFAULT_SETTINGS, targetWidth: 640, targetHeight: 480, resizeMode: 'exact' as const, quality: 75, theme: 'dark' as const };
    saveSettings(s);
    const loaded = loadSettings();
    expect(loaded.targetWidth).toBe(640);
    expect(loaded.targetHeight).toBe(480);
    expect(loaded.resizeMode).toBe('exact');
    expect(loaded.quality).toBe(75);
    expect(loaded.theme).toBe('dark');
  });

  it('returns defaults when nothing stored', () => {
    clearSettings();
    const loaded = loadSettings();
    expect(loaded.resizeMode).toBe(DEFAULT_SETTINGS.resizeMode);
    expect(loaded.ratioLocked).toBe(true);
  });

  it('returns defaults on corrupt JSON', () => {
    localStorage.setItem('picturabox-settings-v1', '{not valid json');
    const loaded = loadSettings();
    expect(loaded.resizeMode).toBe(DEFAULT_SETTINGS.resizeMode);
  });
});