'use strict';

const http = require('node:http');
const querystring = require('node:querystring');

/**
 * In-process fixture web app.
 * - Two accounts: alice / bob with passwords.
 * - Session cookie `sid` identifies account.
 * - /login POST {username,password} -> sets sid.
 * - /api/data -> returns account-specific items if sid valid.
 * - /challenge GET -> evaluates fingerprint headers to decide if bot.
 *   Detects bot if: missing stealth headers, navigator.webdriver not undefined.
 * - /ping -> health check.
 */
const ACCOUNTS = {
  alice: { password: 'alicepw', data: [{ id: 1, name: 'alice-secret-1' }, { id: 2, name: 'alice-secret-2' }] },
  bob: { password: 'bobpw', data: [{ id: 3, name: 'bob-secret-1' }, { id: 4, name: 'bob-secret-2' }] },
};

const HTML_INDEX = `
<!DOCTYPE html><html><head><title>Fixture Site</title></head><body>
<h1>Fixture Site</h1>
<form id="login-form">
  <input id="username" name="username" placeholder="username" />
  <input id="password" name="password" type="password" placeholder="password" />
  <button id="login" type="submit">Log in</button>
</form>
<div id="account-data" style="display:none;"></div>
<button id="logout" style="display:none;">Logout</button>
<script>
  const data = document.getElementById('account-data');
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const res = await fetch('/login', {method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:username.value, password:password.value})});
    if (res.ok) {
      const j = await res.json();
      data.textContent = j.account + ':' + JSON.stringify(j.items);
      data.style.display = 'block';
      form.style.display = 'none';
      document.getElementById('logout').style.display = 'block';
    }
  });
  document.getElementById('logout').onclick = async () => {
    await fetch('/logout', {method:'POST', credentials:'include'});
    data.style.display = 'none';
    form.style.display = 'block';
    document.getElementById('logout').style.display = 'none';
  };
</script>
</body></html>
`;

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) acc[k] = v.join('=');
    return acc;
  }, {});
}

function setCookie(res, name, value, opts = {}) {
  let c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
  if (opts.maxAge) c += `; Max-Age=${opts.maxAge}`;
  res.setHeader('Set-Cookie', c);
}

function getAccountFromCookie(cookies) {
  return cookies.sid || null;
}

function challengeHeaders(req) {
  // The fixture browser sends these when stealthy.
  return {
    'x-navigator-webdriver': req.headers['x-navigator-webdriver'] || 'true',
    'x-stealth-token': req.headers['x-stealth-token'] || '',
    'x-user-agent': req.headers['x-user-agent'] || '',
    'x-viewport': req.headers['x-viewport'] || '',
    'x-real-input': req.headers['x-real-input'] || 'false',
  };
}

function isBotDetected(headers) {
  // Bot if: navigator.webdriver is 'true' (not undefined), or missing stealth token, or headless UA
  if (headers['x-navigator-webdriver'] === 'true') return true;
  if (!headers['x-stealth-token']) return true;
  if (/HeadlessChrome/i.test(headers['x-user-agent'])) return true;
  if (headers['x-real-input'] !== 'true') return true;
  const vp = headers['x-viewport'];
  if (!vp || vp === '0x0') return true;
  return false;
}

function FixtureSite(port = 0) {
  this.port = port;
  this.server = null;
}

FixtureSite.prototype.start = function () {
  return new Promise((resolve, reject) => {
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.on('error', reject);
    this.server.listen(this.port, () => {
      this.port = this.server.address().port;
      resolve(this);
    });
  });
};

FixtureSite.prototype.stop = function () {
  return new Promise((resolve) => {
    if (this.server) this.server.close(resolve);
    else resolve();
  });
};

FixtureSite.prototype.handle = async function (req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  await new Promise((r) => req.on('end', r));
  const cookies = parseCookies(req.headers.cookie);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(HTML_INDEX);
  }

  if (pathname === '/login' && req.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      payload = querystring.parse(body);
    }
    const { username, password } = payload;
    const acct = ACCOUNTS[username];
    if (!acct || acct.password !== password) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'invalid credentials' }));
    }
    setCookie(res, 'sid', username, { maxAge: 3600 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ account: username, items: acct.data }));
  }

  if (pathname === '/logout' && req.method === 'POST') {
    setCookie(res, 'sid', '', { maxAge: 0 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (pathname === '/api/data' && req.method === 'GET') {
    const account = getAccountFromCookie(cookies);
    if (!account || !ACCOUNTS[account]) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unauthorized' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ account, items: ACCOUNTS[account].data }));
  }

  if (pathname === '/challenge' && req.method === 'GET') {
    const fp = challengeHeaders(req);
    if (isBotDetected(fp)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'bot challenge triggered', fingerprint: fp }));
    }
    res.writeHead(204);
    return res.end();
  }

  res.writeHead(404);
  res.end('Not found');
};

module.exports = { FixtureSite, ACCOUNTS };