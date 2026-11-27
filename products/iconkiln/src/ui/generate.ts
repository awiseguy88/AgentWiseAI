import type { SourceImage, GenerateSettings, GeneratedAsset, SizeSpec } from '../core/types';
import { PRESET_SIZES, parseCustomSizes, mergeSizes, sizeKey, clampSize } from '../core/sizes';
import { loadSourceImage, releaseSource, SourceLoadError } from '../core/loader';
import { loadSample, SAMPLES } from '../core/sample';
import { renderToCanvas, renderNative } from '../core/raster';
import { canvasToPngDataUrl } from '../core/png';
import { buildAssets, buildSinglePng } from '../core/build';
import { buildPackZip } from '../core/packZip';
import { triggerDownload, downloadBytes } from '../core/download';
import JSZip from 'jszip';

export interface GenerateState {
  source: SourceImage | null;
  settings: GenerateSettings;
  presetValues: number[];
  customInput: string;
  preview1to1: boolean;
  lastAssets: GeneratedAsset[];
}

export interface GenerateCallbacks {
  onSourceChange: (src: SourceImage | null) => void;
}

function showMessage(container: HTMLElement, kind: 'error' | 'ok', text: string): void {
  const el = container.querySelector<HTMLElement>('#source-message');
  if (!el) return;
  el.textContent = text;
  el.className = `message show ${kind}`;
}

function clearMessage(container: HTMLElement): void {
  const el = container.querySelector<HTMLElement>('#source-message');
  if (!el) return;
  el.className = 'message';
  el.textContent = '';
}

export function renderGenerate(container: HTMLElement, state: GenerateState, cb: GenerateCallbacks): void {
  const s = state.settings;
  const presetChips = PRESET_SIZES.map(
    (n) => `<button type="button" class="chip ${state.presetValues.includes(n) ? 'active' : ''}" data-preset="${n}">${n}</button>`
  ).join('');

  const sampleOptions = SAMPLES.map(
    (sm) => `<button type="button" class="btn small" data-sample="${sm.id}">${sm.label}</button>`
  ).join('');

  container.innerHTML = `
    <h2 class="page-title">Generate</h2>
    <p class="page-sub">Load one source image, choose sizes and a background, then export a multi-resolution .ico, per-size PNGs, or a complete favicon pack. Everything runs locally.</p>

    <div class="panel">
      <div class="dropzone" id="dropzone">
        <svg class="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
        <h3>Drop an image or click to browse</h3>
        <p>PNG, SVG, JPG, BMP, GIF, WebP · up to 32 MB</p>
      </div>
      <input type="file" id="file-input" accept="image/png,image/svg+xml,image/jpeg,image/bmp,image/gif,image/webp,.png,.svg,.jpg,.jpeg,.bmp,.gif,.webp" class="hidden" />
      <div class="message" id="source-message" role="status" aria-live="polite"></div>
      <div id="source-card"></div>
      <div class="row" style="margin-top:14px;align-items:center;">
        <span class="field-label" style="margin:0;">Load sample:</span>
        <div class="chip-row">${sampleOptions}</div>
      </div>
    </div>

    <div class="panel">
      <h3>Configuration</h3>
      <div class="row">
        <div class="field">
          <label>Icon type</label>
          <div class="segmented" id="type-seg">
            <button type="button" data-type="multi" class="${s.iconType === 'multi' ? 'active' : ''}">Multi-res .ico</button>
            <button type="button" data-type="per-size" class="${s.iconType === 'per-size' ? 'active' : ''}">One file per size</button>
          </div>
        </div>
        <div class="field">
          <label>Background</label>
          <div class="segmented" id="bg-seg">
            <button type="button" data-bg="transparent" class="${s.background === 'transparent' ? 'active' : ''}">Keep transparency</button>
            <button type="button" data-bg="flatten" class="${s.background === 'flatten' ? 'active' : ''}">Flatten</button>
          </div>
        </div>
        <div class="field ${s.background === 'flatten' ? '' : 'hidden'}" id="flatten-field">
          <label for="flatten-color">Flatten color</label>
          <input type="color" id="flatten-color" value="${s.flattenColor}" />
        </div>
      </div>

      <div class="field" style="margin-top:16px;">
        <label>Preset sizes</label>
        <div class="chip-row" id="preset-chips">${presetChips}</div>
      </div>

      <div class="field" style="margin-top:16px;max-width:420px;">
        <label for="custom-sizes">Custom sizes ([W]x[H], comma separated)</label>
        <input type="text" id="custom-sizes" placeholder="30x30,60x60" value="${state.customInput}" />
        <div class="hint hidden" id="custom-hint"></div>
      </div>
    </div>

    <div class="panel">
      <div class="row" style="justify-content:space-between;align-items:center;">
        <h3 style="margin:0;">Preview</h3>
        <div class="segmented" id="scale-seg">
          <button type="button" data-scale="fit" class="${!state.preview1to1 ? 'active' : ''}">Fit</button>
          <button type="button" data-scale="1to1" class="${state.preview1to1 ? 'active' : ''}">1:1</button>
        </div>
      </div>
      <div id="preview-area"></div>
    </div>

    <div class="panel">
      <h3>Export</h3>
      <div class="row">
        <button type="button" class="btn primary" id="export-main">Export</button>
        <button type="button" class="btn" id="export-pack">Download ZIP pack</button>
      </div>
      <div class="toast-area"><div class="message" id="export-message" role="status" aria-live="polite"></div></div>
    </div>
  `;

  wireEvents(container, state, cb);
  renderSourceCard(container, state);
  renderPreview(container, state);
}

function wireEvents(container: HTMLElement, state: GenerateState, cb: GenerateCallbacks): void {
  const dropzone = container.querySelector<HTMLElement>('#dropzone')!;
  const fileInput = container.querySelector<HTMLInputElement>('#file-input')!;

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) handleFile(f, container, state, cb);
    fileInput.value = '';
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f, container, state, cb);
  });

  container.querySelectorAll<HTMLElement>('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      clearMessage(container);
      try {
        const src = await loadSample(btn.dataset.sample!);
        replaceSource(container, state, cb, src);
        showMessage(container, 'ok', `Loaded sample "${src.name}" (${src.width}×${src.height}).`);
      } catch (e) {
        showMessage(container, 'error', e instanceof Error ? e.message : 'Could not load sample.');
      }
    });
  });

  container.querySelectorAll<HTMLElement>('#type-seg [data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.settings.iconType = btn.dataset.type as GenerateSettings['iconType'];
      refreshSeg(container, '#type-seg', 'data-type', btn.dataset.type!);
      renderPreview(container, state);
      updateExportLabel(container, state);
    });
  });

  container.querySelectorAll<HTMLElement>('#bg-seg [data-bg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.settings.background = btn.dataset.bg as GenerateSettings['background'];
      refreshSeg(container, '#bg-seg', 'data-bg', btn.dataset.bg!);
      container.querySelector('#flatten-field')?.classList.toggle('hidden', state.settings.background !== 'flatten');
      renderPreview(container, state);
    });
  });

  const colorInput = container.querySelector<HTMLInputElement>('#flatten-color');
  colorInput?.addEventListener('input', () => {
    state.settings.flattenColor = colorInput.value;
    renderPreview(container, state);
  });

  container.querySelectorAll<HTMLElement>('#preset-chips [data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.preset!, 10);
      const idx = state.presetValues.indexOf(n);
      if (idx >= 0) state.presetValues.splice(idx, 1);
      else state.presetValues.push(n);
      btn.classList.toggle('active', idx < 0);
      applySizes(container, state);
    });
  });

  const custom = container.querySelector<HTMLInputElement>('#custom-sizes');
  custom?.addEventListener('input', () => {
    state.customInput = custom.value;
    applySizes(container, state);
  });

  container.querySelectorAll<HTMLElement>('#scale-seg [data-scale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.preview1to1 = btn.dataset.scale === '1to1';
      refreshSeg(container, '#scale-seg', 'data-scale', btn.dataset.scale!);
      renderPreview(container, state);
    });
  });

  container.querySelector('#export-main')?.addEventListener('click', () => handleExportMain(container, state));
  container.querySelector('#export-pack')?.addEventListener('click', () => handleExportPack(container, state));

  updateExportLabel(container, state);
}

function refreshSeg(container: HTMLElement, sel: string, attr: string, value: string): void {
  container.querySelectorAll<HTMLElement>(`${sel} button`).forEach((b) => {
    b.classList.toggle('active', b.getAttribute(attr) === value);
  });
}

function applySizes(container: HTMLElement, state: GenerateState): void {
  const parsed = parseCustomSizes(state.customInput);
  const hint = container.querySelector<HTMLElement>('#custom-hint');
  if (hint) {
    if (parsed.errors.length > 0) {
      hint.textContent = parsed.errors.join(' ') + (parsed.clamped ? ' Values outside 16–256 were clamped.' : '');
      hint.classList.remove('hidden');
    } else if (parsed.clamped) {
      hint.textContent = 'Values outside 16–256 were clamped to range.';
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
      hint.textContent = '';
    }
  }
  state.settings.sizes = mergeSizes(state.presetValues, parsed.sizes);
  renderPreview(container, state);
  updateExportLabel(container, state);
}

function replaceSource(container: HTMLElement, state: GenerateState, cb: GenerateCallbacks, src: SourceImage): void {
  releaseSource(state.source);
  state.source = src;
  cb.onSourceChange(src);
  clearMessage(container);
  renderSourceCard(container, state);
  renderPreview(container, state);
  updateExportLabel(container, state);
}

async function handleFile(file: File, container: HTMLElement, state: GenerateState, cb: GenerateCallbacks): Promise<void> {
  clearMessage(container);
  try {
    const src = await loadSourceImage(file);
    replaceSource(container, state, cb, src);
  } catch (e) {
    if (e instanceof SourceLoadError) {
      showMessage(container, 'error', e.message);
    } else {
      showMessage(container, 'error', e instanceof Error ? e.message : 'Could not load that file.');
    }
  }
}

function renderSourceCard(container: HTMLElement, state: GenerateState): void {
  const card = container.querySelector<HTMLElement>('#source-card');
  if (!card) return;
  const src = state.source;
  if (!src) {
    card.innerHTML = '';
    return;
  }
  const kb = (src.bytes / 1024).toFixed(1);
  let thumbUrl = '';
  try {
    const c = renderToCanvas(src, 72, 72, { background: 'transparent', flattenColor: '#ffffff' });
    thumbUrl = canvasToPngDataUrl(c);
  } catch {
    thumbUrl = '';
  }
  card.innerHTML = `
    <div class="source-card">
      <img class="source-thumb" src="${thumbUrl}" alt="Source preview" />
      <div class="source-meta">
        <div class="name">${escapeHtml(src.name)}</div>
        <div class="sub">${src.width}×${src.height} px · ${kb} KB · ${escapeHtml(src.type)}</div>
      </div>
    </div>
  `;
}

function renderPreview(container: HTMLElement, state: GenerateState): void {
  const area = container.querySelector<HTMLElement>('#preview-area');
  if (!area) return;
  const src = state.source;
  if (!src) {
    area.innerHTML = `<p class="empty-note">Load a source image to see per-size previews.</p>`;
    return;
  }
  const sizes = state.settings.sizes;
  if (sizes.length === 0) {
    area.innerHTML = `<p class="empty-note">Select at least one size to preview.</p>`;
    return;
  }
  const tiles = sizes.map((sz) => {
    const canvas = state.preview1to1
      ? renderNative(src, { background: state.settings.background, flattenColor: state.settings.flattenColor })
      : renderToCanvas(src, sz.w, sz.h, { background: state.settings.background, flattenColor: state.settings.flattenColor });
    const url = canvasToPngDataUrl(canvas);
    return `
      <div class="tile" data-size="${sizeKey(sz)}">
        <div class="tile-checker"><img src="${url}" alt="${sz.w}x${sz.h} preview" style="${state.preview1to1 ? 'image-rendering:auto;' : ''}"/></div>
        <div class="tile-info">
          <div class="tile-name">${sz.w}×${sz.h}</div>
          <div class="tile-meta">${state.preview1to1 ? 'native scale' : 'exact pixels'}</div>
        </div>
        <div class="tile-actions"><button type="button" class="btn small" data-dl-size="${sz.w}x${sz.h}">PNG</button></div>
      </div>
    `;
  });
  area.innerHTML = `<div class="preview-grid">${tiles.join('')}</div>`;

  area.querySelectorAll<HTMLElement>('[data-dl-size]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const [w, h] = btn.dataset.dlSize!.split('x').map(Number);
      if (!state.source) return;
      const asset = await buildSinglePng(state.source, state.settings, { w, h } as SizeSpec);
      downloadBytes(asset.bytes, asset.name, asset.mime);
    });
  });
}

function updateExportLabel(container: HTMLElement, state: GenerateState): void {
  const btn = container.querySelector<HTMLElement>('#export-main');
  if (!btn) return;
  const count = state.settings.sizes.length;
  const disabled = !state.source || count === 0;
  (btn as HTMLButtonElement).disabled = disabled;
  btn.textContent = state.settings.iconType === 'multi' ? 'Export .ico' : `Export ${count} PNG${count === 1 ? '' : 's'}`;
  const packBtn = container.querySelector<HTMLElement>('#export-pack') as HTMLButtonElement | null;
  if (packBtn) packBtn.disabled = disabled;
}

async function handleExportMain(container: HTMLElement, state: GenerateState): Promise<void> {
  if (!state.source) return;
  const msg = container.querySelector<HTMLElement>('#export-message');
  try {
    const assets = await buildAssets(state.source, state.settings);
    state.lastAssets = assets;
    if (state.settings.iconType === 'multi') {
      const ico = assets.find((a) => a.role === 'favicon-ico')!;
      downloadBytes(ico.bytes, ico.name, ico.mime);
      if (msg) { msg.textContent = `Exported ${ico.name}.`; msg.className = 'message show ok'; }
    } else {
      const zip = new JSZip();
      for (const a of assets) zip.file(a.name, a.bytes);
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, `${state.source.name.replace(/\.[^.]+$/, '')}-icons.zip`);
      if (msg) { msg.textContent = `Exported ${assets.length} PNG files as a ZIP.`; msg.className = 'message show ok'; }
    }
  } catch (e) {
    if (msg) { msg.textContent = e instanceof Error ? e.message : 'Export failed.'; msg.className = 'message show error'; }
  }
}

async function handleExportPack(container: HTMLElement, state: GenerateState): Promise<void> {
  if (!state.source) return;
  const msg = container.querySelector<HTMLElement>('#export-message');
  try {
    const result = await buildPackZip(state.source, state.settings);
    triggerDownload(result.blob, result.fileName);
    if (msg) { msg.textContent = `Downloaded ${result.fileName} (${result.fileCount} files).`; msg.className = 'message show ok'; }
  } catch (e) {
    if (msg) { msg.textContent = e instanceof Error ? e.message : 'Pack export failed.'; msg.className = 'message show error'; }
  }
}

export function defaultGenerateState(): GenerateState {
  const presetValues = [16, 32, 48, 64, 128];
  return {
    source: null,
    settings: {
      iconType: 'multi',
      sizes: mergeSizes(presetValues, []),
      background: 'transparent',
      flattenColor: '#ffffff',
    },
    presetValues,
    customInput: '',
    preview1to1: false,
    lastAssets: [],
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export { clampSize };
export type { SizeSpec };