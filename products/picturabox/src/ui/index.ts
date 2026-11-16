import type { Settings } from '../engine/types';
import { getOutputFormats } from '../engine/formats';

export function renderToolbar(
  container: HTMLElement,
  settings: Settings,
  onChange: (partial: Partial<Settings>) => void
): void {
  const formats = getOutputFormats();
  const qualityHidden = settings.outputFormat === 'png';
  container.innerHTML = `
    <div class="field">
      <label for="pictura-w">Width (px)</label>
      <input id="pictura-w" type="number" min="0" value="${settings.targetWidth || ''}" placeholder="auto" />
    </div>
    <div class="field">
      <label for="pictura-h">Height (px)</label>
      <input id="pictura-h" type="number" min="0" value="${settings.targetHeight || ''}" placeholder="auto" />
    </div>
    <div class="field">
      <label>Aspect ratio</label>
      <div class="segmented" id="ratio-lock">
        <button type="button" class="${settings.ratioLocked ? 'active' : ''}" data-lock="true">Locked</button>
        <button type="button" class="${settings.ratioLocked ? '' : 'active'}" data-lock="false">Free</button>
      </div>
    </div>
    <div class="field">
      <label for="pictura-mode">Resize mode</label>
      <select id="pictura-mode">
        ${(['exact', 'contain', 'cover', 'percentage'] as const).map(m => `<option value="${m}" ${settings.resizeMode === m ? 'selected' : ''}>${m[0].toUpperCase() + m.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="pictura-format">Output format</label>
      <select id="pictura-format">
        ${formats.map(f => `<option value="${f.id}" ${settings.outputFormat === f.id ? 'selected' : ''} ${!f.supported ? 'disabled title="' + (f.gated || 'Not supported') + '"' : ''}>${f.label}${!f.supported ? ' (unsupported)' : ''}</option>`).join('')}
      </select>
    </div>
    <div class="field ${qualityHidden ? 'hidden' : ''}" id="quality-field">
      <label>Quality: <span class="qlabel" id="quality-label">${settings.quality}%</span></label>
      <input id="pictura-quality" type="range" min="1" max="100" value="${settings.quality}" />
    </div>
    <div class="field">
      <label for="pictura-pattern">Filename pattern</label>
      <select id="pictura-pattern">
        ${(['pictura_xxx', 'original_resized', 'custom_{name}', 'original'] as const).map(p => `<option value="${p}" ${settings.filenamePattern === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="pictura-custom">Custom name</label>
      <input id="pictura-custom" type="text" value="${settings.customName}" ${settings.filenamePattern === 'custom_{name}' ? '' : 'disabled'} />
    </div>
    <div class="field">
      <label>Theme</label>
      <div class="segmented" id="theme-toggle">
        <button type="button" class="${settings.theme === 'light' ? 'active' : ''}" data-theme="light">Light</button>
        <button type="button" class="${settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">Dark</button>
      </div>
    </div>
    <div class="field">
      <label>Actions</label>
      <button class="btn primary" id="export-zip" type="button">Export ZIP</button>
    </div>
  `;

  const wEl = container.querySelector<HTMLInputElement>('#pictura-w')!;
  const hEl = container.querySelector<HTMLInputElement>('#pictura-h')!;
  wEl.addEventListener('input', () => onChange({ targetWidth: parseInt(wEl.value, 10) || 0 }));
  hEl.addEventListener('input', () => onChange({ targetHeight: parseInt(hEl.value, 10) || 0 }));

  container.querySelectorAll<HTMLButtonElement>('#ratio-lock button').forEach(btn => {
    btn.addEventListener('click', () => onChange({ ratioLocked: btn.dataset.lock === 'true' }));
  });

  const modeEl = container.querySelector<HTMLSelectElement>('#pictura-mode')!;
  modeEl.addEventListener('change', () => onChange({ resizeMode: modeEl.value as Settings['resizeMode'] }));

  const formatEl = container.querySelector<HTMLSelectElement>('#pictura-format')!;
  formatEl.addEventListener('change', () => onChange({ outputFormat: formatEl.value as Settings['outputFormat'] }));

  const qualityEl = container.querySelector<HTMLInputElement>('#pictura-quality')!;
  const qualityLabel = container.querySelector<HTMLElement>('#quality-label')!;
  qualityEl.addEventListener('input', () => {
    qualityLabel.textContent = `${qualityEl.value}%`;
    onChange({ quality: parseInt(qualityEl.value, 10) });
  });

  const patternEl = container.querySelector<HTMLSelectElement>('#pictura-pattern')!;
  const customEl = container.querySelector<HTMLInputElement>('#pictura-custom')!;
  patternEl.addEventListener('change', () => {
    onChange({ filenamePattern: patternEl.value as Settings['filenamePattern'] });
    renderToolbar(container, { ...settings, filenamePattern: patternEl.value as Settings['filenamePattern'] }, onChange);
  });
  customEl.addEventListener('input', () => onChange({ customName: customEl.value }));

  container.querySelectorAll<HTMLButtonElement>('#theme-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      onChange({ theme: btn.dataset.theme as Settings['theme'] });
      renderToolbar(container, { ...settings, theme: btn.dataset.theme as Settings['theme'] }, onChange);
    });
  });
}

export function renderDropzone(container: HTMLElement, onFiles: (files: File[]) => void): void {
  container.innerHTML = `
    <div class="dropzone" id="dz" tabindex="0" role="button" aria-label="Drop or choose images">
      <svg class="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <h2>Drop images here</h2>
      <p>or click to choose files — JPG, PNG, WebP, AVIF, BMP, GIF, TIFF, SVG</p>
      <input id="dz-input" type="file" accept="image/*,.svg,.tiff,.tif" multiple hidden />
    </div>
  `;

  const dz = container.querySelector<HTMLElement>('#dz')!;
  const input = container.querySelector<HTMLInputElement>('#dz-input')!;

  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') input.click();
  });
  input.addEventListener('change', () => {
    if (input.files) onFiles(Array.from(input.files));
    input.value = '';
  });
  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('dragging');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragging');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) onFiles(files);
  });
}

export function renderPrivacyStatement(container: HTMLElement): void {
  container.innerHTML = `
    <div class="privacy" title="No uploads, no network calls after load">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      Your images never leave your device
    </div>
  `;
}

export function renderProgress(container: HTMLElement, current: number, total: number): void {
  container.classList.remove('hidden');
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  container.innerHTML = `
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-label">Processing ${current} / ${total} (${pct}%)</div>
  `;
}

export function clearProgress(container: HTMLElement): void {
  container.classList.add('hidden');
  container.innerHTML = '';
}

export function renderBulkRenamePreview(
  container: HTMLElement,
  entries: { name: string; size: number }[],
  onExport?: () => void
): void {
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="bulk">
      <h3>Bulk rename preview</h3>
      <ul class="bulk-list">
        ${entries.map(e => `<li><span>${e.name}</span><span class="muted">${e.size} KB</span></li>`).join('')}
      </ul>
      <div class="modal-actions">
        <button class="btn" id="bulk-close" type="button">Close</button>
        ${onExport ? '<button class="btn primary" id="bulk-export" type="button">Export ZIP</button>' : ''}
      </div>
    </div>
  `;
  container.querySelector('#bulk-close')?.addEventListener('click', () => {
    container.classList.add('hidden');
    container.innerHTML = '';
  });
  container.querySelector('#bulk-export')?.addEventListener('click', () => onExport?.());
}

export function renderThumbnailGrid(
  container: HTMLElement,
  records: any[],
  settings: any,
  onCropClick: (rec: any) => void,
  onRemove: (id: string) => void,
  onCopy: (rec: any) => void
): void {
  container.innerHTML = records.map(rec => {
    const w = settings.targetWidth || rec.width;
    const h = settings.targetHeight || rec.height;
    const label = rec.error ? 'error' : (rec.type.split('/')[1] || 'img').toUpperCase();
    return `
      <div class="thumb-card" data-id="${rec.id}">
        <div class="thumb-media" data-crop="${rec.id}">
          ${rec.error ? `<div class="toast">${rec.error}</div>` : `<img src="${rec.dataUrl}" alt="${rec.name}" />`}
          <div class="crop-hint">click to crop</div>
        </div>
        <div class="thumb-info">
          <div class="thumb-name" title="${rec.name}">${rec.name}</div>
          <div class="thumb-meta">
            <span class="badge fmt">${label}</span>
            <span>${rec.width}×${rec.height}</span>
            <span>${(rec.size / 1024).toFixed(1)} KB</span>
          </div>
        </div>
        <div class="thumb-actions">
          <button class="btn" data-crop-btn="${rec.id}" type="button">Crop</button>
          <button class="btn" data-copy-btn="${rec.id}" type="button">Copy</button>
          <button class="btn" data-remove-btn="${rec.id}" type="button">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll<HTMLElement>('[data-crop]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.crop!;
      const rec = records.find(r => r.id === id);
      if (rec) onCropClick(rec);
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-remove-btn]').forEach(btn => {
    btn.addEventListener('click', () => onRemove(btn.dataset.removeBtn!));
  });
  container.querySelectorAll<HTMLButtonElement>('[data-copy-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.copyBtn!;
      const rec = records.find(r => r.id === id);
      if (rec) onCopy(rec);
    });
  });
}