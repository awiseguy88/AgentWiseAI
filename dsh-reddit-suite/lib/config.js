import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export const SECRET_KEYS = new Set([
  'cookie', 'password', 'otp', 'clientSecret', 'refreshToken', 'accessToken', 'apiKey', 'token'
]);

export function redactString(s) {
  if (typeof s !== 'string') return s;
  if (s.length <= 8) return '[redacted]';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function redactSecrets(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (typeof value === 'string') {
    // redact common cookie/token-like blobs in freeform strings
    if (/reddit_session=|token_v2=|Bearer\s+[A-Za-z0-9._\-]+/i.test(value)) return '[redacted-secret]';
    return value;
  }
  if (Array.isArray(value)) return value.map(v => redactSecrets(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.has(k) || /secret|password|cookie|token|apikey|api_key/i.test(k)) {
        out[k] = v == null ? v : '[redacted]';
      } else {
        out[k] = redactSecrets(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function safeJson(value, space) {
  try { return JSON.stringify(value, null, space); } catch { return String(value); }
}

export function resolveDbPath(config, ctx) {
  const raw = (config.dbPath || '').trim();
  let p;
  if (raw) {
    p = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  } else {
    // prefer a stable data location near cwd; caller may override
    const base = process.env.DSH_PROFILE_DIR || process.cwd();
    p = join(base, 'data', 'reddit-suite.sqlite');
  }
  mkdirSync(dirname(p), { recursive: true });
  return p;
}

export function normalizeConfig(raw = {}) {
  const cfg = {
    authMode: raw.authMode || 'auto',
    cookie: typeof raw.cookie === 'string' ? raw.cookie.trim() : '',
    userAgent: (typeof raw.userAgent === 'string' && raw.userAgent.trim()) || 'dsh-reddit-suite/1.0 (+https://github.com/deepseek-ai/dsh)',
    baseUrl: (raw.baseUrl || 'https://www.reddit.com').replace(/\/$/, ''),
    oauthBaseUrl: (raw.oauthBaseUrl || 'https://oauth.reddit.com').replace(/\/$/, ''),
    dbPath: raw.dbPath || '',
    requestTimeoutMs: Number(raw.requestTimeoutMs) > 0 ? Number(raw.requestTimeoutMs) : 30000,
    minIntervalMs: Number(raw.minIntervalMs) >= 0 ? Number(raw.minIntervalMs) : 1200,
    maxRetries: Number.isInteger(raw.maxRetries) && raw.maxRetries >= 0 ? raw.maxRetries : 3,
    retryBackoffMs: Number(raw.retryBackoffMs) > 0 ? Number(raw.retryBackoffMs) : 1500,
    maxMoreBatches: Number.isInteger(raw.maxMoreBatches) && raw.maxMoreBatches > 0 ? raw.maxMoreBatches : 50,
    maxMoreChildren: Number.isInteger(raw.maxMoreChildren) && raw.maxMoreChildren > 0 ? raw.maxMoreChildren : 5000,
    maxCommentDepth: Number.isInteger(raw.maxCommentDepth) && raw.maxCommentDepth > 0 ? raw.maxCommentDepth : 200,
    maxItemsPerCall: Number.isInteger(raw.maxItemsPerCall) && raw.maxItemsPerCall > 0 ? raw.maxItemsPerCall : 100,
    storeRawJson: raw.storeRawJson !== false,
    enableWriteActions: raw.enableWriteActions === true,
    oauth: raw.oauth && typeof raw.oauth === 'object' ? { ...raw.oauth } : {},
    login: raw.login && typeof raw.login === 'object' ? { ...raw.login } : {},
    captchaSolver: raw.captchaSolver && typeof raw.captchaSolver === 'object' ? { ...raw.captchaSolver } : (raw.login?.captchaSolver && typeof raw.login.captchaSolver === 'object' ? { ...raw.login.captchaSolver } : null),
  };
  return cfg;
}

export function requireWriteAccess(cfg, args) {
  if (!cfg.enableWriteActions) {
    throw new Error('Write/moderation actions are disabled. Set config.enableWriteActions=true to enable gated write actions.');
  }
  if (args?.confirm !== true) {
    throw new Error('Write/moderation actions require explicit confirmation. Re-run with confirm=true (and optionally dryRun=true first).');
  }
}

export function pickAuthMode(cfg, requested) {
  const mode = requested || cfg.authMode || 'auto';
  if (mode === 'session_cookie') return 'session_cookie';
  if (mode === 'oauth') return 'oauth';
  // auto: prefer oauth token if present else cookie
  const hasToken = !!(cfg.oauth?.accessToken);
  const hasCookie = !!cfg.cookie;
  if (hasToken) return 'oauth';
  if (hasCookie) return 'session_cookie';
  return 'session_cookie';
}

export function assertAuthAvailable(cfg, mode) {
  if (mode === 'oauth') {
    if (!cfg.oauth?.accessToken) throw new Error('OAuth auth selected but no oauth.accessToken is configured. Use reddit_oauth_begin/exchange or configure an access token.');
  } else {
    if (!cfg.cookie) throw new Error('Session-cookie auth selected but no cookie is configured. Set plugin config.cookie to your Reddit session Cookie header value.');
  }
}
