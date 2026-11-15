import { assertAuthAvailable, pickAuthMode, redactSecrets, safeJson } from './config.js';

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
  });
}

export class RateLimiter {
  constructor(minIntervalMs = 0) {
    this.minIntervalMs = minIntervalMs;
    this._nextAt = 0;
    this._chain = Promise.resolve();
  }
  async wait(signal) {
    const run = async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this._nextAt - now);
      this._nextAt = Math.max(now, this._nextAt) + this.minIntervalMs;
      if (waitMs > 0) await sleep(waitMs, signal);
    };
    this._chain = this._chain.then(run, run);
    return this._chain;
  }
}

export class RedditHttpClient {
  constructor(cfg) {
    this.cfg = cfg;
    this.limiter = new RateLimiter(cfg.minIntervalMs || 0);
  }

  _buildUrl(pathOrUrl, base) {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const b = base || this.cfg.baseUrl;
    return `${b}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }

  _headers(mode, extra = {}) {
    const h = {
      'User-Agent': this.cfg.userAgent,
      'Accept': 'application/json, text/plain, */*',
      ...extra,
    };
    if (mode === 'oauth') {
      h['Authorization'] = `Bearer ${this.cfg.oauth?.accessToken}`;
    } else {
      h['Cookie'] = this.cfg.cookie;
    }
    return h;
  }

  async request(pathOrUrl, opts = {}) {
    const cfg = this.cfg;
    const mode = pickAuthMode(cfg, opts.authMode);
    assertAuthAvailable(cfg, mode);
    const base = mode === 'oauth' ? (opts.baseUrl || cfg.oauthBaseUrl) : (opts.baseUrl || cfg.baseUrl);
    const url = this._buildUrl(pathOrUrl, base);
    const method = (opts.method || 'GET').toUpperCase();
    const maxRetries = opts.maxRetries ?? cfg.maxRetries ?? 0;
    let attempt = 0;
    let lastErr;
    while (attempt <= maxRetries) {
      await this.limiter.wait(opts.signal);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? cfg.requestTimeoutMs ?? 30000);
      const onAbort = () => controller.abort();
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const headers = this._headers(mode, opts.headers);
        const init = { method, headers, redirect: opts.redirect || 'follow', signal: controller.signal };
        if (opts.body !== undefined) {
          if (opts.body instanceof URLSearchParams || typeof opts.body === 'string') {
            init.body = opts.body;
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
          } else {
            init.body = typeof opts.body === 'object' ? JSON.stringify(opts.body) : String(opts.body);
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
          }
        }
        const res = await fetch(url, init);
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        const result = { ok: res.ok, status: res.status, statusText: res.statusText, url: res.url || url, headers: Object.fromEntries(res.headers.entries()), text, json, mode };
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          if (attempt < maxRetries) {
            const ra = Number(res.headers.get('retry-after'));
            const backoff = Number.isFinite(ra) && ra > 0 ? ra * 1000 : (cfg.retryBackoffMs || 1500) * Math.pow(2, attempt);
            attempt++;
            await sleep(Math.min(backoff, 60000), opts.signal);
            continue;
          }
        }
        // detect login/HTML block for session flows
        if (mode === 'session_cookie' && res.status === 200 && typeof text === 'string' && /<html/i.test(text) && /login/i.test(text) && !json) {
          result.authProblem = 'html_login_page';
        }
        if ((res.status === 401 || res.status === 403) && !json && typeof text === 'string' && /blocked|forbidden|captcha|login/i.test(text)) {
          result.authProblem = result.authProblem || 'forbidden_or_challenge';
        }
        return result;
      } catch (e) {
        lastErr = e;
        if (attempt < maxRetries) {
          attempt++;
          await sleep((cfg.retryBackoffMs || 1500) * Math.pow(2, attempt - 1), opts.signal);
          continue;
        }
        throw new Error(`HTTP request failed (${method} ${url}): ${e?.message || e}`);
      } finally {
        clearTimeout(timeout);
        opts.signal?.removeEventListener('abort', onAbort);
      }
    }
    throw lastErr || new Error('HTTP request failed');
  }

  async getJson(pathOrUrl, opts = {}) {
    const q = opts.query;
    let p = pathOrUrl;
    if (q && typeof q === 'object') {
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
      const qs = usp.toString();
      if (qs) p += (p.includes('?') ? '&' : '?') + qs;
    }
    const res = await this.request(p, { ...opts, method: 'GET' });
    if (!res.ok) {
      const msg = res.json?.message || res.json?.error || res.json?.reason || res.statusText;
      const err = new Error(`Reddit request failed: HTTP ${res.status} ${msg || ''}`.trim());
      err.status = res.status;
      err.body = redactSecrets(res.json || res.text?.slice(0, 500));
      err.url = res.url;
      throw err;
    }
    if (res.json == null) {
      const err = new Error('Expected JSON response but received non-JSON content (possible login/challenge/block page).');
      err.status = res.status;
      err.url = res.url;
      err.authProblem = res.authProblem || 'non_json';
      err.bodyPreview = (res.text || '').slice(0, 300);
      throw err;
    }
    return res;
  }

  async postForm(pathOrUrl, form, opts = {}) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form || {})) if (v !== undefined && v !== null) body.set(k, String(v));
    return this.request(pathOrUrl, { ...opts, method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers||{}) } });
  }

  async postJson(pathOrUrl, payload, opts = {}) {
    return this.request(pathOrUrl, { ...opts, method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) } });
  }
}

export function ensureArray(x) { return Array.isArray(x) ? x : x == null ? [] : [x]; }
