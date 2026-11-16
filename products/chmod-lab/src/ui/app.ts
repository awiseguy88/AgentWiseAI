import { ChmodLab, labFromStored } from '../lab';
import { decodeSharedState, encodeSharedState } from '../core/share';
import { loadHistory, loadStored, saveStored, type StoredState } from '../core/storage';
import { modeToState, toSymbolic, toMode, computeWarnings } from '../core/permissions';
import { umaskFormula } from '../core/steps';
import type { PermissionState } from '../types';

const COMMON_MODES: Array<{ oct: string; label: string; note: string }> = [
  { oct: '777', label: 'World-writable', note: 'Everything allowed' },
  { oct: '755', label: 'Standard executable', note: 'Owner full, others read+exec' },
  { oct: '644', label: 'Standard file', note: 'Owner rw, others read' },
  { oct: '600', label: 'Private', note: 'Owner only' },
  { oct: '700', label: 'Owner only', note: 'Owner full' },
  { oct: '775', label: 'Group writable', note: 'Owner+group full' },
  { oct: '664', label: 'Group readable', note: 'Owner rw, group read' },
  { oct: '444', label: 'Read-only', note: 'Everyone reads' },
  { oct: '400', label: 'Owner read', note: 'Owner read only' },
];

type Theme = 'light' | 'dark';

export function mountChmodLab(root: HTMLElement): void {
  const stored: StoredState | null = loadStored();
  const initial = stored ? labFromStored(stored) : new ChmodLab();

  const shared = decodeSharedState(window.location.hash);
  if (shared) {
    initial.state = modeToState(shared.mode, shared.kind);
    initial.expression = shared.expression || '';
    initial.warnings = computeWarnings(initial.state);
  }

  let theme: Theme = stored?.theme || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const state: { lab: ChmodLab; theme: Theme } = { lab: initial, theme };
  let historyList: PermissionState[] = loadHistory();

  root.innerHTML = `
  <div class="lab-shell">
    <header class="lab-header">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <span class="dot r"></span><span class="dot w"></span><span class="dot x"></span>
        </div>
        <div>
          <h1>Chmod Lab</h1>
          <p class="tagline">Convert and understand Unix permissions entirely in your browser.</p>
        </div>
      </div>
      <div class="header-actions">
        <button id="btn-share" class="btn ghost" title="Copy shareable link">Share</button>
        <button id="btn-export" class="btn ghost" title="Export settings as JSON">Export</button>
        <button id="btn-import" class="btn ghost" title="Import settings from JSON">Import</button>
        <button id="btn-theme" class="btn ghost" title="Toggle theme">Theme</button>
      </div>
    </header>

    <main class="lab-main">
      <section class="panel panel-left">
        <div class="panel-block">
          <h2>Permissions</h2>
          <div class="kind-toggle" role="group" aria-label="File or directory">
            <button id="kind-file" class="chip-toggle" data-kind="file">File</button>
            <button id="kind-dir" class="chip-toggle" data-kind="directory">Directory</button>
          </div>
          <table class="perm-grid" role="grid" aria-label="Permission grid">
            <thead>
              <tr>
                <th></th><th>Read (r)</th><th>Write (w)</th><th>Execute (x)</th>
              </tr>
            </thead>
            <tbody>
              <tr data-class="owner">
                <th scope="row">Owner</th>
                <td><input type="checkbox" data-class="owner" data-bit="read" aria-label="Owner read" /></td>
                <td><input type="checkbox" data-class="owner" data-bit="write" aria-label="Owner write" /></td>
                <td><input type="checkbox" data-class="owner" data-bit="execute" aria-label="Owner execute" /></td>
              </tr>
              <tr data-class="group">
                <th scope="row">Group</th>
                <td><input type="checkbox" data-class="group" data-bit="read" aria-label="Group read" /></td>
                <td><input type="checkbox" data-class="group" data-bit="write" aria-label="Group write" /></td>
                <td><input type="checkbox" data-class="group" data-bit="execute" aria-label="Group execute" /></td>
              </tr>
              <tr data-class="other">
                <th scope="row">Other</th>
                <td><input type="checkbox" data-class="other" data-bit="read" aria-label="Other read" /></td>
                <td><input type="checkbox" data-class="other" data-bit="write" aria-label="Other write" /></td>
                <td><input type="checkbox" data-class="other" data-bit="execute" aria-label="Other execute" /></td>
              </tr>
            </tbody>
          </table>
          <div class="special-bits">
            <span class="label">Special:</span>
            <label><input type="checkbox" id="sp-setuid" /> Setuid (4)</label>
            <label><input type="checkbox" id="sp-setgid" /> Setgid (2)</label>
            <label><input type="checkbox" id="sp-sticky" /> Sticky (1)</label>
          </div>
        </div>

        <div class="panel-block">
          <h2>Direct input</h2>
          <label class="field">
            <span>Octal (1–4 digits)</span>
            <input id="octal-input" type="text" inputmode="numeric" placeholder="755" />
            <em class="error" id="octal-error"></em>
          </label>
          <label class="field">
            <span>Symbolic (9 chars)</span>
            <input id="symbolic-input" type="text" placeholder="rwxr-xr-x" />
            <em class="error" id="symbolic-error"></em>
          </label>
        </div>

        <div class="panel-block">
          <h2>Common modes</h2>
          <div class="mode-chips" id="mode-chips"></div>
        </div>
      </section>

      <section class="panel panel-right">
        <div class="result-card">
          <div class="result-grid">
            <div class="result-cell"><span>Octal</span><strong id="res-octal">755</strong></div>
            <div class="result-cell"><span>4-digit</span><strong id="res-four">0755</strong></div>
            <div class="result-cell full"><span>Symbolic</span><strong id="res-symbolic">rwxr-xr-x</strong></div>
            <div class="result-cell full"><span>ls -l</span><strong id="res-lsl">-rwxr-xr-x</strong></div>
          </div>
          <ul class="description" id="res-description"></ul>
        </div>

        <div class="warnings" id="res-warnings"></div>

        <div class="panel-block">
          <h2>Steps</h2>
          <ol class="steps" id="res-steps"></ol>
        </div>

        <div class="panel-block">
          <h2>Commands</h2>
          <div class="cmd-row">
            <code id="cmd-octal">chmod 755 file</code>
            <button class="btn tiny" data-copy="cmd-octal">Copy</button>
          </div>
          <div class="cmd-row">
            <code id="cmd-symbolic">chmod u=rwxs,g=rx,o=rx file</code>
            <button class="btn tiny" data-copy="cmd-symbolic">Copy</button>
          </div>
          <div class="cmd-row" id="cmd-find-row" hidden>
            <code id="cmd-find"></code>
            <button class="btn tiny" data-copy="cmd-find">Copy</button>
          </div>
        </div>

        <div class="panel-block">
          <h2>Expression &amp; umask</h2>
          <div class="expr-row">
            <input id="expr-input" type="text" placeholder="e.g. u+x, go-w, a=rX" />
            <input id="umask-input" type="text" inputmode="numeric" placeholder="umask 022" />
            <button id="btn-apply" class="btn primary">Use this</button>
          </div>
          <em class="error" id="expr-error"></em>
          <div class="umask-defaults" id="umask-defaults"></div>
        </div>

        <div class="panel-block">
          <h2>History</h2>
          <div id="res-history" class="history"></div>
        </div>
      </section>
    </main>

    <footer class="lab-footer">
      <p>Privacy: Your data never leaves your device. Chmod Lab runs fully offline after the static bundle loads.</p>
      <p>Part of the AaronWiseAI open-source tool collection — <a href="https://aaronwiseai.com/" rel="noopener">https://aaronwiseai.com/</a></p>
    </footer>
  </div>`;

  const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => root.querySelector(sel) as T;

  const modeChipsEl = $('#mode-chips');
  modeChipsEl.innerHTML = COMMON_MODES.map(
    (m) => `<button class="mode-chip" data-oct="${m.oct}" title="${m.note}"><strong>${m.oct}</strong><span>${m.label}</span></button>`,
  ).join('');

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  }

  function reflectTheme(): void {
    document.documentElement.setAttribute('data-theme', state.theme);
    $('#btn-theme').textContent = state.theme === 'dark' ? 'Light' : 'Dark';
  }

  function historyReplaceHash(): void {
    const hash = encodeSharedState(toMode(state.lab.state), state.lab.state.kind, state.lab.expression);
    const url = new URL(window.location.href);
    url.hash = hash;
    window.history.replaceState(null, '', url.toString());
  }

  function syncInputsFromState(): void {
    ($('#octal-input') as HTMLInputElement).value = state.lab.octal;
    ($('#symbolic-input') as HTMLInputElement).value = state.lab.symbolic;
    ($('#expr-input') as HTMLInputElement).value = state.lab.expression;
    ($('#umask-input') as HTMLInputElement).value = state.lab.umask;
  }

  function persist(): void {
    saveStored({
      mode: toMode(state.lab.state),
      kind: state.lab.state.kind,
      expression: state.lab.expression,
      theme: state.theme,
      umask: state.lab.umask,
    });
    historyReplaceHash();
  }

  function render(): void {
    const lab = state.lab;
    $('#kind-file').classList.toggle('active', lab.state.kind === 'file');
    $('#kind-dir').classList.toggle('active', lab.state.kind === 'directory');

    (['owner', 'group', 'other'] as const).forEach((cls) => {
      (['read', 'write', 'execute'] as const).forEach((bit) => {
        const cb = root.querySelector<HTMLInputElement>(`input[data-class="${cls}"][data-bit="${bit}"]`);
        if (cb) cb.checked = lab.state[cls][bit];
      });
    });
    ($('#sp-setuid') as HTMLInputElement).checked = lab.state.setuid;
    ($('#sp-setgid') as HTMLInputElement).checked = lab.state.setgid;
    ($('#sp-sticky') as HTMLInputElement).checked = lab.state.sticky;

    $('#res-octal').textContent = lab.octal;
    $('#res-four').textContent = lab.fourDigit;
    $('#res-symbolic').textContent = lab.symbolic;
    $('#res-lsl').textContent = lab.lsL;
    $('#res-description').innerHTML = lab.description.map((d) => `<li>${escapeHtml(d)}</li>`).join('');
    $('#res-steps').innerHTML = lab.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('');

    const warnEl = $('#res-warnings');
    if (lab.warnings.length === 0) {
      warnEl.innerHTML = `<p class="ok-note">No risky-mode warnings.</p>`;
    } else {
      warnEl.innerHTML = lab.warnings.map((w) => `<div class="warn"><span>${escapeHtml(w.message)}</span></div>`).join('');
    }

    const cmds = lab.commands;
    $('#cmd-octal').textContent = cmds.octal;
    $('#cmd-symbolic').textContent = cmds.symbolic;
    const findRow = $('#cmd-find-row') as HTMLElement;
    if (cmds.find) {
      findRow.hidden = false;
      $('#cmd-find').textContent = cmds.find;
    } else {
      findRow.hidden = true;
    }

    const um = umaskFormula(lab.state.kind, lab.umask);
    $('#umask-defaults').innerHTML =
      `<div class="umask-line"><span>${escapeHtml(um.label)}</span><code>${escapeHtml(um.value)}</code></div>` +
      `<div class="umask-line"><span>Effective creation mode</span><code>${lab.creationMode}</code></div>`;

    renderHistory();
    reflectTheme();
  }

  function renderHistory(): void {
    const el = $('#res-history');
    if (historyList.length === 0) {
      el.innerHTML = `<p class="muted">No conversions yet this session.</p>`;
      return;
    }
    el.innerHTML = historyList
      .map((h) => {
        const four = toMode(h).toString(8).padStart(4, '0');
        const sym = toSymbolic(h);
        return `<button class="history-item" data-four="${four}" data-kind="${h.kind}"><strong>${four}</strong> <span>${escapeHtml(sym)}</span></button>`;
      })
      .join('');
    el.querySelectorAll<HTMLButtonElement>('.history-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = parseInt(btn.dataset.four || '0755', 8);
        state.lab.state = modeToState(mode, (btn.dataset.kind as 'file' | 'directory') || 'file');
        state.lab.warnings = computeWarnings(state.lab.state);
        commit();
      });
    });
  }

  function commit(): void {
    state.lab.warnings = computeWarnings(state.lab.state);
    const mode = toMode(state.lab.state);
    const existing = historyList.findIndex((h) => toMode(h) === mode && h.kind === state.lab.state.kind);
    if (existing !== -1) historyList.splice(existing, 1);
    historyList.unshift({ ...state.lab.state });
    historyList = historyList.slice(0, 10);
    syncInputsFromState();
    render();
    persist();
  }

  root.querySelectorAll<HTMLInputElement>('.perm-grid input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const cls = cb.dataset.class as 'owner' | 'group' | 'other';
      const bit = cb.dataset.bit as 'read' | 'write' | 'execute';
      state.lab.toggleBit(cls, bit);
      commit();
    });
  });

  (['setuid', 'setgid', 'sticky'] as const).forEach((name) => {
    const cb = root.querySelector<HTMLInputElement>(`#sp-${name}`);
    cb?.addEventListener('change', () => {
      state.lab.setSpecial(name, !!cb?.checked);
      commit();
    });
  });

  $('#kind-file').addEventListener('click', () => { state.lab.setKind('file'); commit(); });
  $('#kind-dir').addEventListener('click', () => { state.lab.setKind('directory'); commit(); });

  modeChipsEl.querySelectorAll<HTMLButtonElement>('.mode-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lab.setModeFromOctal(btn.dataset.oct || '755');
      commit();
    });
  });

  ($('#octal-input') as HTMLInputElement).addEventListener('input', () => {
    const val = ($('#octal-input') as HTMLInputElement).value.trim();
    if (val === '') return;
    const r = state.lab.setModeFromOctal(val);
    if (r.ok) {
      $('#octal-error').textContent = '';
      render();
      persist();
      const mode = toMode(state.lab.state);
      const existing = historyList.findIndex((h) => toMode(h) === mode && h.kind === state.lab.state.kind);
      if (existing !== -1) historyList.splice(existing, 1);
      historyList.unshift({ ...state.lab.state });
      historyList = historyList.slice(0, 10);
      renderHistory();
    } else {
      $('#octal-error').textContent = r.error || 'Invalid octal';
    }
  });

  ($('#symbolic-input') as HTMLInputElement).addEventListener('input', () => {
    const val = ($('#symbolic-input') as HTMLInputElement).value.trim();
    if (val === '') return;
    const r = state.lab.setModeFromSymbolic(val);
    if (r.ok) {
      $('#symbolic-error').textContent = '';
      render();
      persist();
      const mode = toMode(state.lab.state);
      const existing = historyList.findIndex((h) => toMode(h) === mode && h.kind === state.lab.state.kind);
      if (existing !== -1) historyList.splice(existing, 1);
      historyList.unshift({ ...state.lab.state });
      historyList = historyList.slice(0, 10);
      renderHistory();
    } else {
      $('#symbolic-error').textContent = r.error || 'Invalid symbolic';
    }
  });

  $('#btn-apply').addEventListener('click', () => {
    const expr = ($('#expr-input') as HTMLInputElement).value;
    state.lab.umask = ($('#umask-input') as HTMLInputElement).value || '022';
    const r = state.lab.applyExpression(expr, state.lab.state.kind);
    if (r.ok) {
      $('#expr-error').textContent = '';
      commit();
    } else {
      $('#expr-error').textContent = r.error || 'Invalid expression';
    }
  });

  ($('#expr-input') as HTMLInputElement).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-apply').click();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-copy');
      if (!id) return;
      const target = root.querySelector<HTMLElement>(`#${id}`);
      if (target) copyText(target.textContent || '');
    });
  });

  $('#btn-share').addEventListener('click', () => { copyText(window.location.href); });

  $('#btn-theme').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    reflectTheme();
    persist();
  });

  $('#btn-export').addEventListener('click', () => {
    const data = {
      mode: toMode(state.lab.state),
      kind: state.lab.state.kind,
      expression: state.lab.expression,
      umask: state.lab.umask,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chmod-lab-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#btn-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          if (typeof parsed.mode === 'number') {
            state.lab.state = modeToState(parsed.mode & 0o7777, parsed.kind === 'directory' ? 'directory' : 'file');
            if (typeof parsed.expression === 'string') state.lab.expression = parsed.expression;
            if (typeof parsed.umask === 'string') state.lab.umask = parsed.umask;
            commit();
          }
        } catch {
          // ignore invalid
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      state.lab.clearError();
      $('#octal-error').textContent = '';
      $('#symbolic-error').textContent = '';
      $('#expr-error').textContent = '';
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      copyText(state.lab.commands.octal);
    }
  });

  function copyText(text: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text: string): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(ta);
  }

  syncInputsFromState();
  render();
  persist();
}
