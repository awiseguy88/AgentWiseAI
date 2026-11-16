import type { PersistedState } from './types.js';

/**
 * Versioned localStorage key. Bump this when the persisted shape changes
 * so we can migrate or discard stale data cleanly.
 */
const STORAGE_KEY = 'deepfield:v1';

const DEFAULTS: PersistedState = {
  version: 1,
  settings: {
    muted: false,
    reducedMotion: false,
    qualityPreset: 'medium',
  },
  lastVisit: null,
};

/**
 * Load persisted state from localStorage.
 *
 * Returns the parsed state if valid, otherwise returns the defaults.
 * Corrupt or missing data never throws — the app always boots.
 */
export function loadPersisted(): PersistedState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULTS, settings: { ...DEFAULTS.settings } };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULTS, settings: { ...DEFAULTS.settings } };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || parsed.version !== DEFAULTS.version) {
      return { ...DEFAULTS, settings: { ...DEFAULTS.settings } };
    }

    return {
      version: parsed.version,
      settings: {
        muted: Boolean(parsed.settings?.muted),
        reducedMotion: Boolean(parsed.settings?.reducedMotion),
        qualityPreset: isQualityPreset(parsed.settings?.qualityPreset)
          ? parsed.settings.qualityPreset
          : DEFAULTS.settings.qualityPreset,
      },
      lastVisit: parsed.lastVisit ?? null,
    };
  } catch {
    return { ...DEFAULTS, settings: { ...DEFAULTS.settings } };
  }
}

/**
 * Persist state to localStorage. Best-effort: failures are swallowed so
 * a full-blocked storage (e.g. private mode) never breaks the app.
 */
export function savePersisted(state: PersistedState): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore — persistence is non-critical.
  }
}

function isQualityPreset(
  value: unknown
): value is PersistedState['settings']['qualityPreset'] {
  return value === 'low' || value === 'medium' || value === 'high';
}