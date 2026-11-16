import './styles.css';
import { decodeAndVerify, signJwt, splitAndDecodeToken } from './crypto/jwt.js';
import { generateDemoJwt, DEMO_SECRET, EXAMPLE_HEADER, EXAMPLE_PAYLOAD } from './fixtures.js';
import { loadSettings, saveSettings } from './state/settings.js';
import { DecodeResult, JwtAlgorithm, JwtHeader, JwtPayload, SUPPORTED_ALGORITHMS, VerifyResult } from './types.js';

const app = document.getElementById('app')!;

const saved = loadSettings();
const initialAlgorithm: JwtAlgorithm = (SUPPORTED_ALGORITHMS as readonly string[]).includes(saved?.algorithm ?? '')
  ? (saved!.algorithm as JwtAlgorithm)
  : 'HS256';

let currentDecode: DecodeResult = { status: 'empty' };
let currentVerify: VerifyResult | undefined;
let renderToken = 0;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderShell(): void {
  app.innerHTML = `
    <div class="container">
      <header class="app-header">
        <div>
          <h1>TokenScope</h1>
          <p class="subtitle">Browser-only JWT debugger — decode, verify, and generate JSON Web Tokens.</p>
        </div>
        <p class="privacy" aria-label="Privacy statement">🔒 Your token never leaves your device</p>
      </header>

      <div class="grid">
        <section class="panel" aria-labelledby="decoder-heading">
          <h2 id="decoder-heading">Decode &amp; verify</h2>

          <label for="token-input">Encoded JWT</label>
          <textarea id="token-input" class="token-input" spellcheck="false" placeholder="Paste a JWT (header.payload.signature)"></textarea>
          <p class="hint">Shortcuts: <span class="kbd">Ctrl</span>+<span class="kbd">V</span> focus, <span class="kbd">Esc</span> clear, <span class="kbd">Ctrl</span>+<span class="kbd">C</span> copy token.</p>

          <div class="row" style="margin-top:12px;">
            <div>
              <label for="verify-secret">Secret or public key (for verification)</label>
              <input id="verify-secret" type="text" spellcheck="false" placeholder="HMAC secret (HS256)" autocomplete="off" />
            </div>
            <div>
              <label for="decode-alg-display">Algorithm (from header)</label>
              <input id="decode-alg-display" type="text" readonly value="—" />
            </div>
          </div>

          <div id="decode-status" class="status-bar" aria-live="polite"></div>
          <div id="decode-error" aria-live="polite"></div>
          <div id="none-warning" aria-live="polite"></div>

          <h3>Header</h3>
          <div class="actions">
            <button type="button" data-copy="header">Copy header JSON</button>
            <span class="copy-feedback" id="copy-header-fb"></span>
          </div>
          <pre id="header-output" class="output" aria-label="Decoded header"></pre>

          <h3>Payload</h3>
          <div class="actions">
            <button type="button" data-copy="payload">Copy payload JSON</button>
            <span class="copy-feedback" id="copy-payload-fb"></span>
          </div>
          <pre id="payload-output" class="output" aria-label="Decoded payload"></pre>

          <h3>Signature</h3>
          <div class="actions">
            <button type="button" data-copy="signature">Copy signature</button>
            <button type="button" data-copy="full">Copy full token</button>
            <span class="copy-feedback" id="copy-signature-fb"></span>
            <span class="copy-feedback" id="copy-full-fb"></span>
          </div>
          <pre id="signature-output" class="output" aria-label="Signature segment"></pre>

          <h3>Claims</h3>
          <div id="claims-output"></div>
        </section>

        <section class="panel" aria-labelledby="generator-heading">
          <h2 id="generator-heading">Generate</h2>

          <div class="row">
            <div>
              <label for="gen-algorithm">Algorithm</label>
              <select id="gen-algorithm">
                ${SUPPORTED_ALGORITHMS.map((a) => `<option value="${a}" ${a === initialAlgorithm ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="gen-secret">Secret (HS256) / key</label>
              <input id="gen-secret" type="text" spellcheck="false" placeholder="Signing secret" autocomplete="off" value="${escapeHtml(saved?.secret ?? '')}" />
            </div>
          </div>

          <h3>Header JSON</h3>
          <textarea id="gen-header" spellcheck="false"></textarea>

          <h3>Payload JSON</h3>
          <textarea id="gen-payload" spellcheck="false"></textarea>

          <div class="actions">
            <button type="button" class="primary" id="generate-btn">Generate JWT</button>
            <button type="button" id="example-btn">Generate example</button>
          </div>
          <div id="gen-error" aria-live="polite"></div>

          <h3>Generated token</h3>
          <textarea id="gen-output" class="token-input" spellcheck="false" readonly placeholder="Generated token will appear here"></textarea>
          <div class="actions">
            <button type="button" id="use-generated-btn">Load into decoder</button>
            <button type="button" data-copy="generated">Copy generated token</button>
            <span class="copy-feedback" id="copy-generated-fb"></span>
          </div>
        </section>
      </div>

      <footer class="app-footer">
        <p><strong>About AaronWiseAI</strong><br/>
        AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit <a href="https://aaronwiseai.com/" target="_blank" rel="noopener noreferrer">https://aaronwiseai.com/</a></p>
        <p>Part of the AaronWiseAI open-source tool collection — <a href="https://aaronwiseai.com/" target="_blank" rel="noopener noreferrer">https://aaronwiseai.com/</a></p>
      </footer>
    </div>
  `;
}

function getEls() {
  return {
    tokenInput: document.getElementById('token-input') as HTMLTextAreaElement,
    verifySecret: document.getElementById('verify-secret') as HTMLInputElement,
    decodeAlgDisplay: document.getElementById('decode-alg-display') as HTMLInputElement,
    decodeStatus: document.getElementById('decode-status') as HTMLDivElement,
    decodeError: document.getElementById('decode-error') as HTMLDivElement,
    noneWarning: document.getElementById('none-warning') as HTMLDivElement,
    headerOutput: document.getElementById('header-output') as HTMLPreElement,
    payloadOutput: document.getElementById('payload-output') as HTMLPreElement,
    signatureOutput: document.getElementById('signature-output') as HTMLPreElement,
    claimsOutput: document.getElementById('claims-output') as HTMLDivElement,
    genAlgorithm: document.getElementById('gen-algorithm') as HTMLSelectElement,
    genSecret: document.getElementById('gen-secret') as HTMLInputElement,
    genHeader: document.getElementById('gen-header') as HTMLTextAreaElement,
    genPayload: document.getElementById('gen-payload') as HTMLTextAreaElement,
    genOutput: document.getElementById('gen-output') as HTMLTextAreaElement,
    genError: document.getElementById('gen-error') as HTMLDivElement,
  };
}

function setNeutralState(): void {
  const els = getEls();
  els.decodeStatus.innerHTML = `<span class="badge neutral">Paste a token to decode</span>`;
  els.decodeError.innerHTML = '';
  els.noneWarning.innerHTML = '';
  els.headerOutput.textContent = '';
  els.payloadOutput.textContent = '';
  els.signatureOutput.textContent = '';
  els.claimsOutput.innerHTML = '<p class="small">No claims to display.</p>';
  els.decodeAlgDisplay.value = '—';
}

function renderClaims(payload: Record<string, unknown>, iat?: number, exp?: number, nbf?: number): string {
  const known: Array<[string, unknown]> = [];
  const add = (k: string, v: unknown) => {
    if (v !== undefined) known.push([k, v]);
  };
  add('iss', payload.iss);
  add('sub', payload.sub);
  add('aud', payload.aud);
  add('iat', payload.iat ?? iat);
  add('nbf', payload.nbf ?? nbf);
  add('exp', payload.exp ?? exp);

  if (known.length === 0) {
    return '<p class="small">No standard claims (iss, sub, aud, iat, nbf, exp) found.</p>';
  }

  const rows = known
    .map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `<tr><th scope="row"><code>${escapeHtml(k)}</code></th><td><code>${escapeHtml(val)}</code></td></tr>`;
    })
    .join('');

  return `<table class="claims-table"><thead><tr><th scope="col">Claim</th><th scope="col">Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDecodeResult(decode: DecodeResult, verify?: VerifyResult): void {
  const els = getEls();
  if (decode.status === 'empty') {
    setNeutralState();
    return;
  }

  if (decode.status === 'error' || !decode.decoded) {
    els.decodeStatus.innerHTML = `<span class="badge bad">Invalid token</span>`;
    els.decodeError.innerHTML = `<div class="notice error">${escapeHtml(decode.error || 'Unable to decode token.')}</div>`;
    els.noneWarning.innerHTML = '';
    els.headerOutput.textContent = '';
    els.payloadOutput.textContent = '';
    els.signatureOutput.textContent = '';
    els.claimsOutput.innerHTML = '<p class="small">No claims to display.</p>';
    els.decodeAlgDisplay.value = '—';
    return;
  }

  const d = decode.decoded;
  els.decodeAlgDisplay.value = d.algorithm;

  const badges: string[] = [];
  if (verify) {
    if (verify.state === 'valid') badges.push(`<span class="badge ok">Valid signature</span>`);
    else if (verify.state === 'invalid') badges.push(`<span class="badge bad">Invalid signature</span>`);
    else if (verify.state === 'unsigned') badges.push(`<span class="badge warn">Unsigned</span>`);
    else if (verify.state === 'unsupported') badges.push(`<span class="badge warn">Unsupported algorithm</span>`);
    else badges.push(`<span class="badge neutral">Signature unchecked</span>`);
  }

  const expState = d.expiry.state;
  if (expState === 'expired') badges.push(`<span class="badge bad">Expired</span>`);
  else if (expState === 'not-yet-valid') badges.push(`<span class="badge warn">Not yet valid</span>`);
  else if (expState === 'active' && d.expiry.exp !== undefined) badges.push(`<span class="badge ok">Active</span>`);

  badges.push(`<span class="badge neutral">${escapeHtml(d.algorithm)}</span>`);
  els.decodeStatus.innerHTML = badges.join('');

  const verifyNote = verify ? `<div class="notice ${verify.state === 'valid' || verify.state === 'unsigned' ? (verify.state === 'unsigned' ? 'warning' : 'info') : verify.state === 'invalid' ? 'error' : 'info'}">${escapeHtml(verify.message)}</div>` : '';
  const expiryNote = `<div class="notice info"><strong>Expiry:</strong> ${escapeHtml(d.expiry.label)} — ${escapeHtml(d.expiry.detail)}</div>`;
  els.decodeError.innerHTML = verifyNote + expiryNote;

  if (d.algorithm === 'none') {
    els.noneWarning.innerHTML = `<div class="notice warning"><strong>Security warning:</strong> This token uses the "none" algorithm and is unsigned. Anyone can forge its contents; do not trust it for authentication or authorization.</div>`;
  } else {
    els.noneWarning.innerHTML = '';
  }

  els.headerOutput.textContent = d.headerJson.pretty;
  els.payloadOutput.textContent = d.payloadJson.pretty;
  els.signatureOutput.textContent = d.signatureRaw || '(empty)';
  els.claimsOutput.innerHTML = renderClaims(d.payload as Record<string, unknown>, d.expiry.iat, d.expiry.exp, d.expiry.nbf);
}

function persistCurrent(): void {
  const els = getEls();
  saveSettings({
    algorithm: els.genAlgorithm.value,
    secret: els.genSecret.value,
    token: els.tokenInput.value,
    headerJson: els.genHeader.value,
    payloadJson: els.genPayload.value,
  });
}

async function runDecode(): Promise<void> {
  const els = getEls();
  const token = els.tokenInput.value;
  const secret = els.verifySecret.value;
  const myToken = ++renderToken;
  const result = await decodeAndVerify(token, secret);
  if (myToken !== renderToken) return; // stale
  currentDecode = result.decode;
  currentVerify = result.verify;
  renderDecodeResult(currentDecode, currentVerify);
  persistCurrent();
}

async function copyText(text: string, feedbackId: string): Promise<void> {
  const fb = document.getElementById(feedbackId);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (fb) {
      fb.textContent = 'Copied!';
      setTimeout(() => { if (fb.textContent === 'Copied!') fb.textContent = ''; }, 1500);
    }
  } catch {
    if (fb) {
      fb.textContent = 'Copy failed';
      setTimeout(() => { if (fb.textContent === 'Copy failed') fb.textContent = ''; }, 1500);
    }
  }
}

function getCopyPayload(kind: string): string {
  const els = getEls();
  if (kind === 'header') return currentDecode.decoded?.headerJson.pretty ?? '';
  if (kind === 'payload') return currentDecode.decoded?.payloadJson.pretty ?? '';
  if (kind === 'signature') return currentDecode.decoded?.signatureRaw ?? '';
  if (kind === 'full') return els.tokenInput.value.trim();
  if (kind === 'generated') return els.genOutput.value;
  return '';
}

function bindEvents(): void {
  const els = getEls();

  els.tokenInput.addEventListener('input', () => { void runDecode(); });
  els.verifySecret.addEventListener('input', () => { void runDecode(); });

  els.genAlgorithm.addEventListener('change', () => {
    const alg = els.genAlgorithm.value;
    try {
      const header = JSON.parse(els.genHeader.value || '{}');
      header.alg = alg;
      if (alg === 'none') delete header.typ; else header.typ = header.typ || 'JWT';
      els.genHeader.value = JSON.stringify(header, null, 2);
    } catch {
      // leave as-is
    }
    persistCurrent();
  });
  els.genSecret.addEventListener('input', persistCurrent);
  els.genHeader.addEventListener('input', persistCurrent);
  els.genPayload.addEventListener('input', persistCurrent);

  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.getAttribute('data-copy') || '';
      const text = getCopyPayload(kind);
      const fbId = `copy-${kind}-fb`;
      void copyText(text, fbId);
    });
  });

  document.getElementById('generate-btn')!.addEventListener('click', async () => {
    els.genError.innerHTML = '';
    try {
      const header = JSON.parse(els.genHeader.value) as JwtHeader;
      const payload = JSON.parse(els.genPayload.value) as JwtPayload;
      if (typeof header.alg !== 'string') throw new Error('Header JSON must include an "alg" field.');
      const secret = els.genSecret.value;
      const token = await signJwt(header, payload, secret);
      els.genOutput.value = token;
      if (header.alg === 'none') {
        els.genError.innerHTML = `<div class="notice warning"><strong>Security warning:</strong> Generated token uses "none" algorithm and is unsigned. Anyone can forge its contents; do not trust it for authentication or authorization.</div>`;
      }
      persistCurrent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate token.';
      els.genError.innerHTML = `<div class="notice error">${escapeHtml(msg)}</div>`;
    }
  });

  document.getElementById('example-btn')!.addEventListener('click', async () => {
    els.genAlgorithm.value = 'HS256';
    els.genSecret.value = DEMO_SECRET;
    els.genHeader.value = JSON.stringify(EXAMPLE_HEADER, null, 2);
    els.genPayload.value = JSON.stringify(EXAMPLE_PAYLOAD, null, 2);
    els.verifySecret.value = DEMO_SECRET;
    try {
      const token = await generateDemoJwt();
      els.genOutput.value = token;
      els.tokenInput.value = token;
      await runDecode();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate example.';
      els.genError.innerHTML = `<div class="notice error">${escapeHtml(msg)}</div>`;
    }
  });

  document.getElementById('use-generated-btn')!.addEventListener('click', async () => {
    const token = els.genOutput.value.trim();
    if (!token) return;
    els.tokenInput.value = token;
    els.verifySecret.value = els.genSecret.value;
    await runDecode();
  });

  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    const inEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (e.key === 'Escape') {
      e.preventDefault();
      els.tokenInput.value = '';
      els.verifySecret.value = '';
      void runDecode();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !inEditable) {
      e.preventDefault();
      els.tokenInput.focus();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !inEditable) {
      const token = els.tokenInput.value.trim();
      if (token) {
        e.preventDefault();
        void copyText(token, 'copy-full-fb');
      }
    }
  });
}

function initialize(): void {
  renderShell();
  const els = getEls();
  els.genHeader.value = saved?.headerJson || JSON.stringify({ ...EXAMPLE_HEADER, alg: initialAlgorithm }, null, 2);
  els.genPayload.value = saved?.payloadJson || JSON.stringify(EXAMPLE_PAYLOAD, null, 2);
  els.genSecret.value = saved?.secret ?? '';
  els.tokenInput.value = saved?.token ?? '';
  if (saved?.token) {
    els.verifySecret.value = saved.secret ?? '';
  }
  bindEvents();
  void runDecode();
}

initialize();
