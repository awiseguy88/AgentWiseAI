import type { Settings } from '../engine/settings';
import { saveSettings } from '../engine/settings';
import { getOutputFormats } from '../engine/formats';

let dark = false;

export function initTheme(theme: 'light' | 'dark'): void {
  dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
}

export function toggleTheme(): void {
  dark = !dark;
  document.documentElement.classList.toggle('dark', dark);
}

export function isDark(): boolean {
  return dark;
}

export function applyThemeToSelect(select: HTMLSelectElement): void {
  select.style.background = dark ? '#1f2937' : '#fff';
  select.style.color = dark ? '#f9fafb' : '#111827';
  select.style.borderColor = dark ? '#374151' : '#d1d5db';
}

export function renderSettingsToolbar(
  container: HTMLElement,
  settings: Settings,
  onChange: (partial: Partial<Settings>) => void
): void {
  const formats = getOutputFormats();

  container.innerHTML = `
    <div class="toolbar" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border)">
      <div class="toolbar-group" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;flex:1">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px">
          Width <input type="number" id="w-input" min="1" max="9999" value="${settings.width || ''}" style="width:70px;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg)">
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px">
          Height <input type="number" id="h-input" min="1" max="9999" value="${settings.height || ''}" style="width:70px;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg)">
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px">
          <input type="checkbox" id="ratio-lock" ${settings.ratioLocked ? 'checked' : ''} style="width:16px;height:16px"> Lock aspect
        </label>
        <select id="mode-select" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg)">
          <option value="exact" ${settings.mode === 'exact' ? 'selected' : ''}>Exact</option>
          <option value="contain" ${settings.mode === 'contain' ? 'selected' : ''}>Contain</option>
          <option value="cover" ${settings.mode === 'cover' ? 'selected' : ''}>Cover</option>
          <option value="percentage" ${settings.mode === 'percentage' ? 'selected' : ''}>Percentage</option>
        </select>
      </div>
      <div class="toolbar-group" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;flex:1">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px">
          Format
          <select id="format-select" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg)">
            ${formats.map(f => `<option value="${f.id}" ${f.id === settings.format ? 'selected' : ''} ${!f.supported ? 'disabled' : ''} title="${f.gated || ''}">${f.label}${!f.supported ? ' (unsupported)' : ''}</option>`).join('')}
          </select>
        </label>
        <label id="quality-label" style="display:flex;align-items:center;gap:6px;font-size:13px">
          Quality <input type="range" id="quality-slider" min="1" max="100" value="${settings.quality}" style="width:120px">
        </label>
      </div>
      <div class="toolbar-group" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;flex:1">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px">
          Naming
          <select id="pattern-select" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg)">
            <option value="pixtrim" ${settings.pattern === 'pixtrim' ? 'selected' : ''}>pixtrim_001</option>
            <option value="original_resized" ${settings.pattern === 'original_resized' ? 'selected' : ''}>original_resized</option>
            <option value="custom" ${settings.pattern === 'custom' ? 'selected' : ''}>custom_001</option>
            <option value="original" ${settings.pattern === 'original' ? 'selected' : ''}>original</option>
          </select>
        </label>
        <label id="custom-pattern-label" style="display:flex;align-items:center;gap:6px;font-size:13px">
          <input type="text" id="custom-pattern-input" value="${settings.customPattern}" placeholder="custom" style="width:100px;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg)">
        </label>
      </div>
      <div class="toolbar-actions" style="display:flex;gap:8px">
        <button id="btn-export-zip" class="btn primary" style="padding:8px 16px;border-radius:6px;border:none;background:var(--accent);color:white;font-weight:600;cursor:pointer">Export ZIP (⌘S)</button>
        <button id="btn-theme-toggle" class="btn" style="padding:8px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--fg);cursor:pointer">${dark ? '☀️' : '🌙'}</button>
      </div>
    </div>
  `;

  const wInput = container.querySelector('#w-input') as HTMLInputElement;
  const hInput = container.querySelector('#h-input') as HTMLInputElement;
  const ratioLock = container.querySelector('#ratio-lock') as HTMLInputElement;
  const modeSelect = container.querySelector('#mode-select') as HTMLSelectElement;
  const formatSelect = container.querySelector('#format-select') as HTMLSelectElement;
  const qualitySlider = container.querySelector('#quality-slider') as HTMLInputElement;
  const qualityLabel = container.querySelector('#quality-label') as HTMLElement;
  const patternSelect = container.querySelector('#pattern-select') as HTMLSelectElement;
  const customPatternInput = container.querySelector('#custom-pattern-input') as HTMLInputElement;
  const customPatternLabel = container.querySelector('#custom-pattern-label') as HTMLElement;
  const btnExportZip = container.querySelector('#btn-export-zip') as HTMLButtonElement;
  const btnThemeToggle = container.querySelector('#btn-theme-toggle') as HTMLButtonElement;

  function updateVisibility(): void {
    const lossy = formats.find(f => f.id === formatSelect.value)?.lossy;
    qualityLabel.style.display = lossy ? 'flex' : 'none';
    customPatternLabel.style.display = patternSelect.value === 'custom' ? 'flex' : 'none';
  }

  wInput.addEventListener('input', () => {
    const w = parseInt(wInput.value, 10) || 0;
    let partial: Partial<Settings> = { width: w };
    if (ratioLock.checked && settings.height > 0 && settings.width > 0) {
      partial.height = Math.round(w * settings.height / settings.width);
    }
    onChange(partial);
  });

  hInput.addEventListener('input', () => {
    const h = parseInt(hInput.value, 10) || 0;
    let partial: Partial<Settings> = { height: h };
    if (ratioLock.checked && settings.width > 0 && settings.height > 0) {
      partial.width = Math.round(h * settings.width / settings.height);
    }
    onChange(partial);
  });

  ratioLock.addEventListener('change', () => onChange({ ratioLocked: ratioLock.checked }));

  modeSelect.addEventListener('change', () => onChange({ mode: modeSelect.value as Settings['mode'] }));

  formatSelect.addEventListener('change', () => {
    onChange({ format: formatSelect.value as Settings['format'] });
    updateVisibility();
  });

  qualitySlider.addEventListener('input', () => onChange({ quality: parseInt(qualitySlider.value, 10) }));

  patternSelect.addEventListener('change', () => {
    onChange({ pattern: patternSelect.value as Settings['pattern'] });
    updateVisibility();
  });

  customPatternInput.addEventListener('input', () => onChange({ customPattern: customPatternInput.value }));

  btnExportZip.addEventListener('click', () => {
    const event = new CustomEvent('pixtrim:export-zip');
    document.dispatchEvent(event);
  });

  btnThemeToggle.addEventListener('click', () => {
    toggleTheme();
    btnThemeToggle.textContent = dark ? '☀️' : '🌙';
    onChange({ theme: dark ? 'dark' : 'light' });
  });

  updateVisibility();
}

export function renderDropzone(
  container: HTMLElement,
  onFiles: (files: File[]) => void
): void {
  container.innerHTML = `
    <div class="dropzone" style="border:2px dashed var(--border);border-radius:12px;padding:48px 24px;text-align:center;background:var(--bg-secondary);transition:border-color 0.15s">
      <div style="font-size:48px;margin-bottom:12px">📁</div>
      <div style="font-size:16px;color:var(--fg);margin-bottom:4px">Drop images here or click to select</div>
      <div style="font-size:12px;color:var(--muted)">JPG, PNG, WebP, AVIF, BMP, GIF, SVG</div>
      <input type="file" id="file-input" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/bmp,image/gif,image/svg+xml" style="display:none">
    </div>
  `;

  const dropzone = container.querySelector('.dropzone') as HTMLElement;
  const fileInput = container.querySelector('#file-input') as HTMLInputElement;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent)'; });
  dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--border)'; });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border)';
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) onFiles(files);
  });
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    if (files.length) onFiles(files);
    fileInput.value = '';
  });
}

export function renderPrivacyStatement(container: HTMLElement): void {
  container.innerHTML = `
    <div style="text-align:center;font-size:12px;color:var(--muted);padding:8px 0;border-top:1px solid var(--border);margin-top:16px">
      <span style="display:inline-flex;align-items:center;gap:4px">🔒 Your images never leave your device</span>
    </div>
  `;
}

export function setDropzoneActive(active: boolean): void {
  const dz = document.querySelector('.dropzone') as HTMLElement;
  if (dz) dz.style.display = active ? 'block' : 'none';
}

export function renderProgress(container: HTMLElement, current: number, total: number): void {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  container.innerHTML = `
    <div style="margin-top:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
        <span>Processing</span><span>${current} / ${total}</span>
      </div>
      <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--accent);transition:width 0.1s"></div>
      </div>
    </div>
  `;
}

export function clearProgress(container: HTMLElement): void {
  container.innerHTML = '';
}

export function renderBulkRenamePreview(
  container: HTMLElement,
  items: Array<{ originalName: string; previewName: string }>
): void {
  if (!items.length) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <details style="margin-top:12px;padding:8px;background:var(--bg-secondary);border-radius:6px;border:1px solid var(--border)">
      <summary style="cursor:pointer;font-weight:600">Bulk rename preview (${items.length} files)</summary>
      <div style="max-height:200px;overflow:auto;margin-top:8px;font-size:12px;font-family:monospace">
        ${items.map(i => `<div style="padding:2px 4px"><span style="color:var(--muted)">${i.originalName}</span> → <span style="color:var(--accent)">${i.previewName}</span></div>`).join('')}
      </div>
    </details>
  `;
}
