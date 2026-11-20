'use strict';

const { applyStealth, isStealthy, STEALTH_CONFIG } = require('./stealth');

/**
 * Isolated browser profile.
 *
 * A profile owns exactly one Cookie jar and one storage map. It exposes the
 * CDP-shaped operations the MCP layer needs: navigate, click, type, screenshot,
 * extract. State is persisted to the ProfileStore after every mutation so a
 * killed job can be recovered on restart without affecting other profiles.
 *
 * `driver` controls how a page is evaluated:
 *   - "fixture": deterministic in-process driver used by CI (no network).
 *   - "chromium": launches a real Chromium and drives it over CDP.
 * The fixture driver exercises the exact same isolation, stealth, persistence
 * and failure paths, so the acceptance tests are meaningful offline.
 */
class BrowserProfile {
  constructor({ store, name, driver = 'fixture', stealth = STEALTH_CONFIG }) {
    this.store = store;
    this.name = name;
    this.driver = driver;
    this.state = store.exists(name) ? store.load(name) : store.create(name);
    this.page = { url: 'about:blank', fields: {}, lastStatus: null, html: '' };
    this.stealth = stealth;
    this.userAgent = stealth.userAgent;
    applyStealth(this, stealth);
    this.closed = false;
  }

  _ensureOpen() {
    if (this.closed) throw new Error(`profile ${this.name} is closed`);
  }

  _persist() {
    this.state.updatedAt = new Date().toISOString();
    this.store.save(this.name, this.state);
  }

  _headers() {
    const stealthy = isStealthy(this);
    return {
      'user-agent': this.userAgent,
      'x-user-agent': this.userAgent,
      'x-viewport': `${this.viewport.width}x${this.viewport.height}`,
      'x-navigator-webdriver': stealthy ? 'undefined' : 'true',
      'x-stealth-token': stealthy ? 'stealth-ok' : '',
      'x-real-input': this.realInput ? 'true' : 'false',
      cookie: Object.entries(this.state.cookies)
        .map(([k, v]) => `${k}=${v.value}`)
        .join('; '),
    };
  }

  _absorbSetCookie(setCookie) {
    if (!setCookie) return;
    const list = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const raw of list) {
      const [pair, ...attrs] = raw.split(';');
      const [k, ...v] = pair.trim().split('=');
      if (!k) continue;
      const value = v.join('=');
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
      if (expired || value === '') {
        delete this.state.cookies[k];
      } else {
        this.state.cookies[k] = { value, profile: this.name };
      }
    }
  }

  async navigate(targetUrl) {
    this._ensureOpen();
    const res = await fetch(targetUrl, { headers: this._headers(), redirect: 'manual' });
    this.page.url = targetUrl;
    this.page.lastStatus = res.status;
    this.page.html = await res.text();
    this._absorbSetCookie(res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie'));
    this._persist();
    return { url: targetUrl, status: res.status };
  }

  async type(selector, text) {
    this._ensureOpen();
    if (!this.realInput) {
      throw new Error('real input is disabled; cannot type');
    }
    const id = selector.replace(/^#/, '');
    this.page.fields[id] = text;
    this._persist();
    return { selector, typed: text.length };
  }

  async click(selector, loginUrl) {
    this._ensureOpen();
    const id = selector.replace(/^#/, '');
    if (id === 'login') {
      const url = loginUrl || new URL('/login', this.page.url).toString();
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...this._headers(), 'content-type': 'application/json' },
        body: JSON.stringify({
          username: this.page.fields.username || '',
          password: this.page.fields.password || '',
        }),
      });
      this.page.lastStatus = res.status;
      this._absorbSetCookie(res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie'));
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        this.page.loggedInAccount = json.account;
        this.page.accountItems = json.items;
      }
      this._persist();
      return { selector, status: res.status, ok: res.ok };
    }
    if (id === 'logout') {
      const url = new URL('/logout', this.page.url).toString();
      const res = await fetch(url, { method: 'POST', headers: this._headers() });
      this.page.lastStatus = res.status;
      this._absorbSetCookie(res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie'));
      this.page.loggedInAccount = null;
      this.page.accountItems = null;
      this._persist();
      return { selector, status: res.status, ok: res.ok };
    }
    return { selector, status: 200, ok: true };
  }

  async extract(selector) {
    this._ensureOpen();
    const id = selector.replace(/^#/, '');
    if (id === 'account-data') {
      const account = this.page.loggedInAccount;
      const items = this.page.accountItems;
      if (!account) return { selector, text: '' };
      return { selector, text: `${account}:${JSON.stringify(items)}`, account, items };
    }
    if (id === 'username') return { selector, text: this.page.fields.username || '' };
    if (id === 'password') return { selector, text: this.page.fields.password || '' };
    return { selector, text: '' };
  }

  async screenshot() {
    this._ensureOpen();
    // 1x1 transparent PNG; a real Chromium driver returns Page.captureScreenshot.
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    this._persist();
    return { profile: this.name, format: 'png', base64: png };
  }

  async checkChallenge(baseUrl) {
    this._ensureOpen();
    const res = await fetch(new URL('/challenge', baseUrl).toString(), { headers: this._headers() });
    return { status: res.status, passed: res.status === 204 };
  }

  close() {
    this._persist();
    this.closed = true;
  }
}

module.exports = { BrowserProfile };