export interface PersistedSettings {
  algorithm: string;
  secret: string;
  token: string;
  headerJson: string;
  payloadJson: string;
}

const STORAGE_KEY = 'token-scope:settings:v1';

export function loadSettings(): PersistedSettings | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      algorithm: typeof parsed.algorithm === 'string' ? parsed.algorithm : 'HS256',
      secret: typeof parsed.secret === 'string' ? parsed.secret : '',
      token: typeof parsed.token === 'string' ? parsed.token : '',
      headerJson: typeof parsed.headerJson === 'string' ? parsed.headerJson : '',
      payloadJson: typeof parsed.payloadJson === 'string' ? parsed.payloadJson : '',
    };
  } catch {
    return null;
  }
}

export function saveSettings(settings: PersistedSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage might be unavailable; ignore
  }
}