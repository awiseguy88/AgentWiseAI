import type { Charset, Newline, Variant, WrapMode, DecodeOptions } from '../types';
import { encodeTextToBase64, decodeBase64, bytesToText, encodeBytes } from '../core/base64';
import {
  readFileAsArrayBuffer,
  downloadText,
  downloadBytes,
  createZip,
  base64ToFilename,
  decodedFilename,
  computeFileHash,
  guessMimeFromName,
} from '../core/files';
import { copyText } from '../core/clipboard';
import { FIXTURES } from '../fixtures';

type UiMode = 'encode' | 'decode' | 'files';

const STORAGE_KEY = 'base64-bridge:v1';
type Persisted = {
  uiMode: UiMode;
  variant: Variant;
  charset: Charset;
  newline: Newline;
  wrap: WrapMode;
  perLine: boolean;
  strict: boolean;
  autoDetect: boolean;
  live: boolean;
  dark: boolean;
};

const DEFAULTS: Persisted = {
  uiMode: 'encode',
  variant: 'standard',
  charset: 'utf-8',
  newline: 'lf',
  wrap: 'none',
  perLine: false,
  strict: true,
  autoDetect: true,
  live: false,
  dark: false,
};

let state: Persisted = { ...DEFAULTS };
let lastDecodedBytes: Uint8Array | null = null;
let lastDecodedName = 'decoded.bin';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(2)} MB`;
}

function $(id: string): HTMLElement { return document.getElementById(id)!; }

function renderShell() {
  const app = $('app');
  app.innerHTML = `
  <div class="container">
    <header>
      <div>
        <h1>Base64 Bridge</h1>
        <p class="subtitle">Encode and decode text or files to Base64 entirely in your browser.</p>
      </div>
      <div class="header-actions">
        <button id="theme-btn" class="small" type="button" aria-label="Toggle theme">🌙</button>
      </div>
    </header>
    <div class="privacy" role="note">
      <strong>Privacy:</strong> 100% client-side. Your text and files never leave this device and are not uploaded to any server.
    </div>

    <nav class="tabs" role="tablist" aria-label="Mode">
      <button class="tab" id="tab-encode" data-mode="encode" role="tab">Text Encode</button>
      <button class="tab" id="tab-decode" data-mode="decode" role="tab">Text Decode</button>
      <button class="tab" id="tab-files" data-mode="files" role="tab">File Tools</button>
    </nav>

    <div id="global-error" class="error hidden" role="alert"><span id="global-error-text"></span></div>

    <section id="panel-encode" class="card">
      <div class="grid two">
        <div>
          <h2>Input text</h2>
          <label for="enc-input">Plain text to encode</label>
          <textarea id="enc-input" placeholder="Type or paste text here…"></textarea>
          <div class="actions">
            <button id="enc-run" class="primary" type="button">Encode</button>
            <button id="enc-clear" type="button">Clear</button>
          </div>
          <div id="enc-stats" class="stats"></div>
        </div>
        <div>
          <h2>Base64 output</h2>
          <label for="enc-output">Encoded result</label>
          <textarea id="enc-output" readonly placeholder="Encoded Base64 will appear here…"></textarea>
          <div class="actions">
            <button id="enc-copy" type="button">Copy output</button>
            <button id="enc-download" type="button">Download .txt</button>
          </div>
        </div>
      </div>
    </section>

    <section id="panel-decode" class="card hidden">
      <div class="grid two">
        <div>
          <h2>Base64 input</h2>
          <label for="dec-input">Base64 text to decode</label>
          <textarea id="dec-input" placeholder="Paste Base64 here…"></textarea>
          <div id="dec-detected" class="stats"></div>
          <div class="actions">
            <button id="dec-run" class="primary" type="button">Decode</button>
            <button id="dec-clear" type="button">Clear</button>
          </div>
          <div id="dec-stats" class="stats"></div>
        </div>
        <div>
          <h2>Decoded output</h2>
          <label for="dec-output">Decoded text</label>
          <textarea id="dec-output" placeholder="Decoded text will appear here…"></textarea>
          <div id="dec-binary" class="muted hidden"></div>
          <div class="actions">
            <button id="dec-copy" type="button">Copy text</button>
            <button id="dec-download-text" type="button">Download text</button>
            <button id="dec-download-file" type="button">Download decoded file</button>
          </div>
        </div>
      </div>
    </section>

    <section id="panel-files" class="card hidden">
      <h2>Encode files to Base64</h2>
      <div id="drop-zone" class="dropzone" tabindex="0">
        Drop files here or <label for="file-input" style="display:inline;color:var(--accent);cursor:pointer;text-decoration:underline;">choose files</label>
        <input id="file-input" type="file" multiple class="hidden" />
      </div>
      <div class="actions" style="margin-top:10px;">
        <button id="files-clear" type="button">Clear list</button>
        <button id="files-zip" type="button" disabled>Download all as ZIP</button>
      </div>
      <div id="file-list" class="file-list"></div>
      <hr />
      <h3>Included fixtures</h3>
      <p class="muted">Sample files shipped with the app for quick checks (also in <code>public/fixtures/</code>).</p>
      <div id="fixture-list" class="fixture-grid"></div>
    </section>

    <section class="card" style="margin-top:14px;">
      <h2>Options</h2>
      <div class="row">
        <div>
          <label for="opt-variant">Variant</label>
          <select id="opt-variant">
            <option value="standard">Standard (RFC 4648)</option>
            <option value="url-safe">URL-safe</option>
          </select>
        </div>
        <div>
          <label for="opt-charset">Character set</label>
          <select id="opt-charset">
            <option value="utf-8">UTF-8 (default)</option>
            <option value="ascii">ASCII</option>
            <option value="iso-8859-1">ISO-8859-1 (Latin-1)</option>
            <option value="cp1252">Windows-1252</option>
            <option value="utf-16-le">UTF-16 LE</option>
            <option value="utf-16-be">UTF-16 BE</option>
          </select>
        </div>
        <div>
          <label for="opt-newline">Newline style</label>
          <select id="opt-newline">
            <option value="lf">LF (\\n)</option>
            <option value="crlf">CRLF (\\r\\n)</option>
          </select>
        </div>
        <div>
          <label for="opt-wrap">Line wrapping</label>
          <select id="opt-wrap">
            <option value="none">None</option>
            <option value="mime76">76 chars (MIME)</option>
          </select>
        </div>
      </div>
      <div class="inline" style="margin-top:10px; gap:16px;">
        <label><input id="opt-per-line" type="checkbox" /> Encode each line separately</label>
        <label><input id="opt-live" type="checkbox" /> Live mode (encode as you type)</label>
        <label><input id="opt-strict" type="checkbox" /> Strict decode validation</label>
        <label><input id="opt-auto-detect" type="checkbox" /> Auto-detect URL-safe on decode</label>
      </div>
      <p class="muted" style="margin-top:10px;">
        Shortcuts: <span class="kbd">Ctrl/Cmd+Enter</span> run encode/decode, <span class="kbd">Ctrl/Cmd+Shift+C</span> copy output, <span class="kbd">Ctrl/Cmd+Shift+L</span> toggle live mode, <span class="kbd">Esc</span> clear error.
      </p>
    </section>

    <footer>
      <p><strong>About AaronWiseAI</strong></p>
      <p>AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit <a href="https://aaronwiseai.com/">https://aaronwiseai.com/</a></p>
      <p>Part of the AaronWiseAI open-source tool collection — <a href="https://aaronwiseai.com/">https://aaronwiseai.com/</a></p>
    </footer>
  </div>`;
}

function showError(msg: string | null) {
  const el = $('global-error');
  const txt = $('global-error-text');
  if (msg) { txt.textContent = msg; el.classList.remove('hidden'); }
  else { txt.textContent = ''; el.classList.add('hidden'); }
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', state.dark);
  $('theme-btn').textContent = state.dark ? '☀️' : '🌙';
}

function syncOptionsUI() {
  ( $('opt-variant') as HTMLSelectElement).value = state.variant;
  ( $('opt-charset') as HTMLSelectElement).value = state.charset;
  ( $('opt-newline') as HTMLSelectElement).value = state.newline;
  ( $('opt-wrap') as HTMLSelectElement).value = state.wrap;
  ( $('opt-per-line') as HTMLInputElement).checked = state.perLine;
  ( $('opt-live') as HTMLInputElement).checked = state.live;
  ( $('opt-strict') as HTMLInputElement).checked = state.strict;
  ( $('opt-auto-detect') as HTMLInputElement).checked = state.autoDetect;
}

function readOptionsFromUI() {
  state.variant = ( $('opt-variant') as HTMLSelectElement).value as Variant;
  state.charset = ( $('opt-charset') as HTMLSelectElement).value as Charset;
  state.newline = ( $('opt-newline') as HTMLSelectElement).value as Newline;
  state.wrap = ( $('opt-wrap') as HTMLSelectElement).value as WrapMode;
  state.perLine = ( $('opt-per-line') as HTMLInputElement).checked;
  state.live = ( $('opt-live') as HTMLInputElement).checked;
  state.strict = ( $('opt-strict') as HTMLInputElement).checked;
  state.autoDetect = ( $('opt-auto-detect') as HTMLInputElement).checked;
  saveState();
}

function showPanel(mode: UiMode) {
  state.uiMode = mode;
  saveState();
  for (const m of ['encode','decode','files'] as UiMode[]) {
    $(`panel-${m}`).classList.toggle('hidden', m !== mode);
    $(`tab-${m}`).classList.toggle('active', m === mode);
    $(`tab-${m}`).setAttribute('aria-selected', String(m === mode));
  }
  showError(null);
}

function runEncode() {
  const input = ( $('enc-input') as HTMLTextAreaElement).value;
  if (!input) {
    ( $('enc-output') as HTMLTextAreaElement).value = '';
    $('enc-stats').textContent = '';
    showError(null);
    return;
  }
  const result = encodeTextToBase64(input, {
    variant: state.variant,
    charset: state.charset,
    newline: state.newline,
    wrap: state.wrap,
    perLine: state.perLine,
    live: state.live,
  });
  if (!result.ok) {
    showError(result.error);
    ( $('enc-output') as HTMLTextAreaElement).value = '';
    $('enc-stats').textContent = '';
    return;
  }
  showError(null);
  ( $('enc-output') as HTMLTextAreaElement).value = result.text;
  $('enc-stats').textContent = `${result.text.length} characters`;
}

function runDecode() {
  const input = ( $('dec-input') as HTMLTextAreaElement).value.trim();
  lastDecodedBytes = null;
  if (!input) {
    ( $('dec-output') as HTMLTextAreaElement).value = '';
    $('dec-detected').textContent = '';
    $('dec-stats').textContent = '';
    $('dec-binary').classList.add('hidden');
    showError(null);
    return;
  }
  const options: DecodeOptions = {
    variant: state.variant,
    charset: state.charset,
    strict: state.strict,
    autoDetect: state.autoDetect,
  };
  const result = decodeBase64(input, options);
  if (!result.ok) {
    showError(result.error);
    ( $('dec-output') as HTMLTextAreaElement).value = '';
    $('dec-detected').textContent = '';
    $('dec-stats').textContent = '';
    $('dec-binary').classList.add('hidden');
    return;
  }
  showError(null);
  lastDecodedBytes = result.bytes;
  lastDecodedName = decodedFilename('decoded.bin');
  $('dec-stats').textContent = `${result.bytes.byteLength} bytes`;
  $('dec-detected').textContent = state.autoDetect && result.detectedVariant === 'url-safe'
    ? 'Detected URL-safe Base64 input.'
    : '';
  const textResult = bytesToText(result.bytes, state.charset);
  if (textResult.ok) {
    ( $('dec-output') as HTMLTextAreaElement).value = textResult.text;
    $('dec-binary').classList.add('hidden');
  } else {
    ( $('dec-output') as HTMLTextAreaElement).value = '';
    $('dec-binary').textContent = `Binary data (${result.bytes.byteLength} bytes). Use “Download decoded file”.`;
    $('dec-binary').classList.remove('hidden');
  }
}

type FileRec = { name: string; data: Uint8Array; encoded: string; hash: string; size: number };
const fileRecs: FileRec[] = [];

async function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    const ab = await readFileAsArrayBuffer(file);
    const data = new Uint8Array(ab);
    const encoded = encodeBytes(data, state.variant);
    const hash = await computeFileHash(data);
    fileRecs.push({ name: file.name, data, encoded, hash, size: file.size });
  }
  renderFileList();
}

function renderFileList() {
  const list = $('file-list');
  ( $('files-zip') as HTMLButtonElement).disabled = fileRecs.length === 0;
  if (fileRecs.length === 0) {
    list.innerHTML = '<p class="muted">No files encoded yet.</p>';
    return;
  }
  list.innerHTML = fileRecs.map((r, i) => `
    <div class="file-item">
      <div><strong>${escapeHtml(r.name)}</strong> <span class="file-meta">(${formatBytes(r.size)}, SHA-256 ${escapeHtml(r.hash)})</span></div>
      <textarea readonly style="min-height:80px;margin-top:6px;">${escapeHtml(r.encoded)}</textarea>
      <div class="actions">
        <button type="button" data-copy="${i}">Copy Base64</button>
        <button type="button" data-dl="${i}">Download .b64</button>
      </div>
    </div>`).join('');
  list.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = fileRecs[Number(btn.dataset.copy)];
      const ok = await copyText(r.encoded);
      btn.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(()=>btn.textContent='Copy Base64', 1200);
    });
  });
  list.querySelectorAll<HTMLButtonElement>('button[data-dl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = fileRecs[Number(btn.dataset.dl)];
      downloadText(r.encoded, base64ToFilename(r.name, state.variant), 'text/plain');
    });
  });
}

function renderFixtures() {
  const el = $('fixture-list');
  el.innerHTML = FIXTURES.map(f => `
    <div class="fixture">
      <strong>${escapeHtml(f.name)}</strong>
      <div class="muted">${escapeHtml(f.description)}</div>
      <div class="actions" style="margin-top:6px;">
        <a class="btn small" href="${escapeHtml(f.path)}" download>Download</a>
      </div>
    </div>`).join('');
}

function setupEvents() {
  $('theme-btn').addEventListener('click', () => { state.dark = !state.dark; applyTheme(); saveState(); });

  for (const m of ['encode','decode','files'] as UiMode[]) {
    $(`tab-${m}`).addEventListener('click', () => showPanel(m));
  }

  for (const id of ['opt-variant','opt-charset','opt-newline','opt-wrap','opt-per-line','opt-live','opt-strict','opt-auto-detect']) {
    $(id).addEventListener('change', () => { readOptionsFromUI(); if(state.uiMode==='encode' && state.live) runEncode(); if(state.uiMode==='decode') runDecode(); });
  }

  $('enc-run').addEventListener('click', runEncode);
  $('enc-clear').addEventListener('click', () => { ( $('enc-input') as HTMLTextAreaElement).value=''; runEncode(); });
  $('enc-copy').addEventListener('click', async () => {
    const ok = await copyText(( $('enc-output') as HTMLTextAreaElement).value);
    const b=$('enc-copy'); b.textContent = ok?'Copied!':'Copy failed'; setTimeout(()=>b.textContent='Copy output',1200);
  });
  $('enc-download').addEventListener('click', () => downloadText(( $('enc-output') as HTMLTextAreaElement).value, 'encoded.txt', 'text/plain'));
  ( $('enc-input') as HTMLTextAreaElement).addEventListener('input', () => { if (state.live) runEncode(); });

  $('dec-run').addEventListener('click', runDecode);
  $('dec-clear').addEventListener('click', () => { ( $('dec-input') as HTMLTextAreaElement).value=''; runDecode(); });
  $('dec-copy').addEventListener('click', async () => {
    const ok = await copyText(( $('dec-output') as HTMLTextAreaElement).value);
    const b=$('dec-copy'); b.textContent = ok?'Copied!':'Copy failed'; setTimeout(()=>b.textContent='Copy text',1200);
  });
  $('dec-download-text').addEventListener('click', () => downloadText(( $('dec-output') as HTMLTextAreaElement).value, 'decoded.txt', 'text/plain'));
  $('dec-download-file').addEventListener('click', () => {
    if (!lastDecodedBytes) { showError('Nothing decoded yet.'); return; }
    downloadBytes(lastDecodedBytes, lastDecodedName, 'application/octet-stream');
  });
  ( $('dec-input') as HTMLTextAreaElement).addEventListener('input', () => { if (state.live) runDecode(); });

  const fileInput = $('file-input') as HTMLInputElement;
  fileInput.addEventListener('change', async () => { if (fileInput.files) await addFiles(fileInput.files); fileInput.value=''; });
  const dz = $('drop-zone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', async e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer?.files) await addFiles(e.dataTransfer.files); });

  $('files-clear').addEventListener('click', () => { fileRecs.length = 0; renderFileList(); });
  $('files-zip').addEventListener('click', () => {
    if (fileRecs.length === 0) return;
    const entries = fileRecs.map(r => ({ name: base64ToFilename(r.name, state.variant), data: new TextEncoder().encode(r.encoded) }));
    const zip = createZip(entries);
    downloadBytes(zip, 'base64-encoded.zip', 'application/zip');
  });

  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { showError(null); return; }
    if (!mod) return;
    if (e.key === 'Enter') { e.preventDefault(); if(state.uiMode==='encode') runEncode(); else if(state.uiMode==='decode') runDecode(); }
    if (e.key.toLowerCase() === 'c' && e.shiftKey) {
      e.preventDefault();
      if (state.uiMode==='encode') $('enc-copy').click(); else $('dec-copy').click();
    }
    if (e.key.toLowerCase() === 'l' && e.shiftKey) {
      e.preventDefault();
      state.live = !state.live; syncOptionsUI(); saveState();
    }
  });
}

export function initApp() {
  loadState();
  renderShell();
  applyTheme();
  syncOptionsUI();
  showPanel(state.uiMode || 'encode');
  renderFileList();
  renderFixtures();
  setupEvents();
}
