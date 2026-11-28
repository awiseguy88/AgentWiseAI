import { describe, it, expect, beforeEach } from 'vitest';
import { loadTheme, saveTheme, applyTheme, toggleTheme } from '../src/core/theme';

describe('theme persistence (ICK-017)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light when nothing stored', () => {
    expect(loadTheme()).toBe('light');
  });

  it('saves and reloads dark', () => {
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('applyTheme sets the data-theme attribute', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggleTheme flips and persists', () => {
    const next = toggleTheme('light');
    expect(next).toBe('dark');
    expect(loadTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});