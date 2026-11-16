import type { Settings, ImageRecord, CropRect } from './engine/types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './engine/settings';
import { renderResized, computeTargetSize } from './engine/resize';
import { loadImageFiles } from './engine/loader';
import { buildFilename } from './engine/filename';
import { exportSingleFile, exportZip, triggerDownload, downloadSingleFile } from './engine/export';
import { settingsFromHash, encodeSettingsHash } from './engine/share';
import { renderHeader, initTheme, renderFooter } from './ui/shell';
import { renderToolbar, renderDropzone, renderProgress, clearProgress, renderBulkRenamePreview, renderThumbnailGrid, renderPrivacyStatement } from './ui/index';
import { debounce } from './ui/shell';
import { openCropModal, registerShortcuts } from './ui/modal';

interface AppState {
  settings: Settings;
  records: ImageRecord[];
  perImageCrop: Record<string, CropRect>;
}

const state: AppState = {
  settings: { ...DEFAULT_SETTINGS, ...(settingsFromHash() || loadSettings()) },
  records: [],
  perImageCrop: {},
};

const debouncedRender = debounce(() => renderApp(), 150);

function mergeSettings(partial: Partial<Settings>): void {
  state.settings = { ...state.settings, ...partial };
  saveSettings(state.settings);
  history.replaceState(null, '', encodeSettingsHash(state.settings));
  scheduleRender();
}

function scheduleRender(): void {
  debouncedRender();
}

function renderForExport(rec: ImageRecord): HTMLCanvasElement {
  const crop = state.perImageCrop[rec.id];
  if (crop) {
    const cropped = document.createElement('canvas');
    cropped.width = crop.w;
    cropped.height = crop.h;
    const cctx = cropped.getContext('2d')!;
    cctx.drawImage(rec.canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    return renderResized({ width: crop.w, height: crop.h, canvas: cropped }, state.settings.resizeMode, state.settings.targetWidth, state.settings.targetHeight);
  }
  return renderResized(rec, state.settings.resizeMode, state.settings.targetWidth, state.settings.targetHeight);
}

async function handleExportZip(): Promise<void> {
  if (state.records.length === 0) {
    alert('No images to export');
    return;
  }
  const progressEl = document.getElementById('progress')!;
  const valid = state.records.filter(r => !r.error);
  if (valid.length === 0) {
    alert('No valid images to export');
    return;
  }
  const items = valid.map((rec, i) => ({
    canvas: renderForExport(rec),
    originalName: rec.name,
    format: state.settings.outputFormat,
    quality: state.settings.quality,
    pattern: state.settings.filenamePattern,
    customName: state.settings.customName,
    index: i + 1,
  }));
  try {
    const blob = await exportZip(items, (p) => renderProgress(progressEl, p.current, p.total));
    const filename = state.settings.filenamePattern === 'pictura_xxx'
      ? `pictura_${String(1).padStart(3, '0')}_${String(valid.length).padStart(3, '0')}.zip`
      : `pictura_export_${Date.now()}.zip`;
    triggerDownload(blob, filename);
    clearProgress(progressEl);
    alert(`Exported ${valid.length} images to ZIP`);
  } catch (e) {
    console.error('Export failed', e);
    alert('Export failed. Check console for details.');
    clearProgress(progressEl);
  }
}

function handleCopyImage(rec: ImageRecord): void {
  try {
    const format = state.settings.outputFormat === 'original'
      ? (rec.type.split('/')[1] || 'png')
      : state.settings.outputFormat;
    const canvas = renderForExport(rec);
    const mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/png';
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
      } catch {
        try { await navigator.clipboard.writeText(canvas.toDataURL(mime, state.settings.quality / 100)); } catch {}
      }
    }, mime, state.settings.quality / 100);
  } catch (e) {
    console.error('Copy failed', e);
  }
}

function handleSingleExport(rec: ImageRecord): void {
  const item = {
    canvas: renderForExport(rec),
    originalName: rec.name,
    format: state.settings.outputFormat,
    quality: state.settings.quality,
    pattern: state.settings.filenamePattern,
    customName: state.settings.customName,
    index: 1,
  };
  downloadSingleFile(item);
}

function renderApp(): void {
  const header = document.getElementById('header')!;
  const toolbar = document.getElementById('toolbar')!;
  const dropzone = document.getElementById('dropzone')!;
  const grid = document.getElementById('grid')!;
  const bulkPreview = document.getElementById('bulk')!;
  const footer = document.getElementById('footer')!;

  renderHeader(header);
  initTheme(state.settings);
  renderFooter(footer);
  renderToolbar(toolbar, state.settings, mergeSettings);

  renderDropzone(dropzone, async (files) => {
    const loaded = await loadImageFiles(files);
    state.records.push(...loaded);
    renderApp();
  });

  if (state.records.length > 0) {
    dropzone.classList.add('hidden');
    grid.classList.remove('hidden');
    renderThumbnailGrid(grid, state.records, state.settings, (rec) => {
      openCropModal(rec, (result) => {
        state.perImageCrop[rec.id] = result;
        renderApp();
      }, () => {});
    }, (id) => {
      state.records = state.records.filter(r => r.id !== id);
      delete state.perImageCrop[id];
      renderApp();
    }, (rec) => handleCopyImage(rec));
  }

  const exportBtn = document.getElementById('export-zip');
  if (exportBtn) exportBtn.addEventListener('click', handleExportZip);

  if (state.records.length > 0 && state.settings.filenamePattern === 'custom_{name}') {
    renderBulkRenamePreview(bulkPreview, state.records.map(r => ({ name: buildFilename(state.settings.filenamePattern, r.name, 1, state.settings.outputFormat, state.settings.customName), size: Math.round(r.size / 1024) })), handleExportZip);
  } else {
    bulkPreview.classList.add('hidden');
    bulkPreview.innerHTML = '';
  }

  registerShortcuts(handleExportZip);
}

renderApp();