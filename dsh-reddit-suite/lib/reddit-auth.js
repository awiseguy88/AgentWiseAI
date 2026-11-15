import { pickAuthMode, redactSecrets, safeJson } from './config.js';

function b64(s) { return Buffer.from(String(s)).toString('base64'); }

export function buildOauthAuthorizeUrl(cfg, params = {}) {
  const clientId = params.clientId || cfg.oauth?.clientId;
  const redirectUri = params.redirectUri || cfg.oauth?.redirectUri;
  const scope = params.scope || cfg.oauth?.scope || 'identity read';
  const duration = params.duration || cfg.oauth?.duration || 'permanent';
  const state = params.state || Math.random().toString(36).slice(2);
  if (!clientId) throw new Error('OAuth clientId is required (param or config.oauth.clientId).');
  if (!redirectUri) throw new Error('OAuth redirectUri is required (param or config.oauth.redirectUri).');
  const url = new URL(`${cfg.baseUrl}/api/v1/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('duration', duration);
  url.searchParams.set('scope', scope);
  return { url: url.toString(), state, scope, duration, redirectUri, clientId, instructions: 'Open the URL in a browser, authorize the app, then copy the `code` (and verify `state`) from the redirect URL and call reddit_oauth_exchange.' };
}

export async function exchangeOauthCode(http, db, cfg, params = {}) {
  const clientId = params.clientId || cfg.oauth?.clientId;
  const clientSecret = params.clientSecret ?? cfg.oauth?.clientSecret ?? '';
  const redirectUri = params.redirectUri || cfg.oauth?.redirectUri;
  const code = params.code;
  if (!code) throw new Error('OAuth authorization code is required.');
  if (!clientId || !redirectUri) throw new Error('clientId and redirectUri are required for token exchange.');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const headers = { 'Authorization': `Basic ${b64(`${clientId}:${clientSecret}`)}`, 'User-Agent': cfg.userAgent };
  const res = await http.request(`${cfg.baseUrl}/api/v1/access_token`, { method: 'POST', body, headers, baseUrl: cfg.baseUrl, authMode: 'session_cookie' }); // basic auth header used; cookie not required
  // request() will attach cookie by mode; but access_token uses Basic auth - easier to use fetch directly-ish via http.request with override
  // However our http.request enforces auth availability; for token endpoint we can bypass by crafting: use fetch
  return handleTokenResponse(res, db, cfg, { clientId, persist: params.persist !== false });
}

async function handleTokenResponse(res, db, cfg, meta) {
  const json = res.json;
  if (!res.ok || !json || json.error) {
    const err = json?.error_description || json?.error || res.statusText || 'token exchange failed';
    db.auditAction({ action: 'oauth_token', target: 'access_token', params: { clientId: meta.clientId }, authMode: 'oauth', status: 'error', httpStatus: res.status, error: err });
    throw new Error(`OAuth token request failed: HTTP ${res.status} ${err}`.trim());
  }
  const expiresAt = json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : null;
  const tok = { client_id: meta.clientId, scope: json.scope, access_token: json.access_token, refresh_token: json.refresh_token, token_type: json.token_type, expires_at: expiresAt, raw_json: safeJson(json) };
  // update runtime cfg for subsequent calls in this process
  cfg.oauth = { ...(cfg.oauth||{}), accessToken: tok.access_token, refreshToken: tok.refresh_token || cfg.oauth?.refreshToken, tokenExpiry: expiresAt, scope: tok.scope || cfg.oauth?.scope };
  if (meta.persist !== false) db.saveToken(tok);
  db.auditAction({ action: 'oauth_token', target: 'access_token', params: { clientId: meta.clientId, scope: tok.scope }, authMode: 'oauth', status: 'ok', httpStatus: res.status });
  return { ok: true, token_type: tok.token_type, scope: tok.scope, expires_at: expiresAt, has_refresh_token: !!tok.refresh_token, persisted: meta.persist !== false };
}

export async function exchangeOauthCodeDirect(fetchFn, db, cfg, params = {}) {
  const clientId = params.clientId || cfg.oauth?.clientId;
  const clientSecret = params.clientSecret ?? cfg.oauth?.clientSecret ?? '';
  const redirectUri = params.redirectUri || cfg.oauth?.redirectUri;
  const code = params.code;
  if (!code) throw new Error('OAuth authorization code is required.');
  if (!clientId || !redirectUri) throw new Error('clientId and redirectUri are required for token exchange.');
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const res = await fetch(`${cfg.baseUrl}/api/v1/access_token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${b64(`${clientId}:${clientSecret}`)}`, 'User-Agent': cfg.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return handleTokenResponse({ ok: res.ok, status: res.status, json, text }, db, cfg, { clientId, persist: params.persist !== false });
}

export async function refreshOauthToken(db, cfg, params = {}) {
  const clientId = params.clientId || cfg.oauth?.clientId;
  const clientSecret = params.clientSecret ?? cfg.oauth?.clientSecret ?? '';
  let refreshToken = params.refreshToken || cfg.oauth?.refreshToken;
  if (!refreshToken) {
    const stored = db.getToken();
    refreshToken = stored?.refresh_token;
  }
  if (!clientId) throw new Error('clientId is required to refresh OAuth token.');
  if (!refreshToken) throw new Error('No refresh token available (provide refreshToken param, config.oauth.refreshToken, or a persisted token).');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  const res = await fetch(`${cfg.baseUrl}/api/v1/access_token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${b64(`${clientId}:${clientSecret}`)}`, 'User-Agent': cfg.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  // refresh responses may omit refresh_token; preserve existing
  const wrapped = { ok: res.ok, status: res.status, json, text };
  if (res.ok && json && !json.error && !json.refresh_token) json.refresh_token = refreshToken;
  return handleTokenResponse(wrapped, db, cfg, { clientId, persist: params.persist !== false });
}

export async function attemptWebLogin(http, db, cfg, params = {}) {
  const username = params.username || cfg.login?.username;
  const password = params.password || cfg.login?.password;
  const otp = params.otp || params.otp || cfg.login?.otp;
  if (!username || !password) throw new Error('username and password are required for web login (params or config.login).');
  // Step 1: fetch login page to obtain csrf_token/modhash-like fields if present
  let csrf = null;
  try {
    const page = await http.request('/login', { method: 'GET', authMode: 'session_cookie', baseUrl: cfg.baseUrl, headers: { 'Cookie': cfg.cookie || '' } });
    const m = page.text && page.text.match(/name="csrf_token"\s+value="([^"]+)"/i);
    if (m) csrf = m[1];
  } catch {}
  const form = {
    op: 'login-main',
    user: username,
    passwd: password,
    api_type: 'json',
  };
  if (otp) form.otp = otp;
  if (csrf) form.csrf_token = csrf;
  // carry over captcha fields if retrying with solution
  if (params.captchaId || params.iden) form.iden = params.captchaId || params.iden;
  if (params.captchaResponse || params.captcha) form.captcha = params.captchaResponse || params.captcha;

  const res = await http.postForm('/api/login', form, { authMode: 'session_cookie', baseUrl: cfg.baseUrl, headers: { 'Cookie': cfg.cookie || '' } });
  const json = res.json || {};
  const data = json.json?.data || json.data || {};
  const errors = json.json?.errors || json.errors || [];
  // detect captcha / challenge
  const captchaId = data.iden || data.captcha || null;
  const needsCaptcha = !!captchaId || errors.some(e => String(e?.[0]||e||'').toUpperCase().includes('CAPTCHA'));
  if (needsCaptcha) {
    const challenge = {
      ok: false,
      status: 'captcha_required',
      captchaId,
      captchaUrl: captchaId ? `${cfg.baseUrl}/captcha/${captchaId}` : null,
      errors,
      message: 'Reddit requires CAPTCHA/challenge to continue login. Solve out-of-band and call reddit_submit_login_challenge with captchaId and captchaResponse, or configure/provide an external captcha solver hook.',
      solverHint: cfg.captchaSolver ? { configured: true, type: cfg.captchaSolver.type || 'http' } : { configured: false },
    };
    db.auditAction({ action: 'login', target: username, params: { captcha: true }, authMode: 'session_cookie', status: 'captcha_required', httpStatus: res.status });
    return challenge;
  }
  if (!res.ok || (errors && errors.length)) {
    const errMsg = errors.map(e => Array.isArray(e)? e.join(': ') : String(e)).join('; ') || res.statusText || 'login failed';
    db.auditAction({ action: 'login', target: username, params: {}, authMode: 'session_cookie', status: 'error', httpStatus: res.status, error: errMsg });
    throw new Error(`Login failed: ${errMsg}`);
  }
  // try to extract cookie/session from response
  const cookieFromData = data.cookie || null;
  const setCookie = res.headers?.['set-cookie'] || null;
  const cookie = cookieFromData || setCookie || cfg.cookie || null;
  if (cookie) cfg.cookie = String(cookie);
  db.auditAction({ action: 'login', target: username, params: {}, authMode: 'session_cookie', status: cookie ? 'ok' : 'ok_no_cookie_returned', httpStatus: res.status });
  return { ok: true, status: cookie ? 'logged_in' : 'login_response_ok_no_cookie_extracted', modhash: data.modhash || null, cookieCaptured: !!cookie, message: cookie ? 'Login succeeded and cookie captured in runtime config (not persisted unless you set config.cookie).' : 'Login API responded OK but no cookie was extractable; you may need to supply session cookie manually.' };
}

export async function submitLoginChallenge(http, db, cfg, params = {}) {
  // If external solver hook configured/provided, try to obtain solution
  let captchaResponse = params.captchaResponse || params.captcha;
  let captchaId = params.captchaId || params.iden;
  const solver = params.captchaSolver || cfg.captchaSolver || cfg.login?.captchaSolver;
  if (!captchaResponse && solver && solver.type === 'http' && solver.url) {
    // generic HTTP solver hook: POST {captchaId,captchaUrl,...} expect {solution|captcha|token}
    const solverRes = await fetch(solver.url, {
      method: solver.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...(solver.apiKey ? { 'Authorization': `Bearer ${solver.apiKey}`, 'X-Api-Key': solver.apiKey } : {}), ...(solver.headers||{}) },
      body: JSON.stringify({ captchaId, captchaUrl: captchaId ? `${cfg.baseUrl}/captcha/${captchaId}` : null, site: 'reddit', ...(solver.extra||{}) }),
    });
    const st = await solverRes.text();
    let sj = null; try { sj = JSON.parse(st); } catch {}
    captchaResponse = sj?.solution || sj?.captcha || sj?.token || sj?.response || (typeof sj === 'string' ? sj : null);
    if (!captchaResponse) throw new Error(`Captcha solver hook did not return a solution (HTTP ${solverRes.status}).`);
  }
  if (!captchaId) throw new Error('captchaId (iden) is required to submit a login challenge.');
  if (!captchaResponse) throw new Error('captchaResponse/solution is required. Provide it directly or configure a working external captchaSolver hook.');
  return attemptWebLogin(http, db, cfg, { ...params, captchaId, captchaResponse });
}

export function authStatus(cfg, db) {
  const stored = db ? db.getToken() : null;
  return {
    authMode: cfg.authMode,
    hasSessionCookie: !!cfg.cookie,
    hasOauthAccessToken: !!cfg.oauth?.accessToken,
    hasOauthRefreshToken: !!(cfg.oauth?.refreshToken || stored?.refresh_token),
    oauthClientConfigured: !!cfg.oauth?.clientId,
    storedToken: stored ? { present: true, expires_at: stored.expires_at, scope: stored.scope, updated_at: stored.updated_at } : { present: false },
    captchaSolverConfigured: !!(cfg.captchaSolver || cfg.login?.captchaSolver),
    writeActionsEnabled: !!cfg.enableWriteActions,
  };
}
