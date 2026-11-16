import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, clearSettings } from '../src/engine/settings';

// Mock localStorage for node tests
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('settings persistence', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('M4-A1 saves and restores settings from localStorage', () => {
    const s = { ...DEFAULT_SETTINGS, width: 640, height: 480, mode: 'exact' as const, quality: 75, theme: 'dark' as const };
    saveSettings(s);
    const loaded = loadSettings();
    expect(loaded.width).toBe(640);
    expect(loaded.height).toBe(480);
    expect(loaded.mode).toBe('exact');
    expect(loaded.quality).toBe(75);
    expect(loaded.theme).toBe('dark');
  });

  it('returns defaults when nothing stored', () => {
    clearSettings();
    const loaded = loadSettings();
    expect(loaded.mode).toBe(DEFAULT_SETTINGS.mode);
    expect(loaded.ratioLocked).toBe(true);
  });
});
