import type { Settings } from './engine/settings';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './engine/settings';
import { getOutputFormats, getFormatInfo, detectFormatSupport } from './engine/formats';
import { loadImageFiles, type ImageRecord } from './engine/image-loader';
import { renderResized, computeTargetSize } from './engine/resize';
import { buildFilename } from './engine/filename';
import { exportSingleFile, exportZip, triggerDownload, type ExportItem } from './engine/export';
import { applyCrop, clampCrop } from './engine/crop';
import { settingsFromHash, encodeSettingsHash } from './engine/share';
import { renderSettingsToolbar, renderDropzone, renderPrivacyStatement, renderProgress, clearProgress, renderBulkRenamePreview, initTheme, isDark, renderThumbnailGrid, debounce, openCropModal, registerShortcuts } from './ui';

interface AppState {
  settings: Settings;
  records: ImageRecord[];
  perImageCrop: Record<string, { x: number; y: number; w: number; h: number }>;
}

const state: AppState = {
  settings: { ...DEFAULT_SETTINGS },
  records: [],
  perImageCrop: {},
};

function mergeSettings(partial: Partial<Settings>): void {
  state.settings = { ...state.settings, ...partial };
  saveSettings(state.settings);
  history.replaceState(null, '', encodeSettingsHash(state.settings));
  scheduleRender();
}

function scheduleRender(): void {
  debouncedRender();
}

function renderApp(): void {
  const toolbar = document.getElementById('toolbar')!;
  const grid = document.getElementById('grid')!;
  const dropzone = document.getElementById('dropzone')!;
  const privacy = document.getElementById('privacy')!;
  const bulkPreview = document.getElementById('bulk-preview')!;

  renderSettingsToolbar(toolbar, state.settings, mergeSettings);
  renderDropzone(dropzone, async (files) => {
    const loaded = await loadImageFiles(files);
    state.records.push(...loaded);
    renderApp();
  });
  renderPrivacyStatement(privacy);

  if (state.records.length > 0) {
    dropzone.classList.add('hidden');
    grid.classList.remove('hidden');
    renderThumbnailGrid(grid, state.records, state.settings, (rec) => {
      openCropModal(rec, (result) => {
        state.perImageCrop[rec.id] = result.rect;
        renderApp();
      }, () => {});
    }, (id) => {
      state.records = state.records.filter(r => r.id !== id);
      delete state.perImageCrop[id];
      renderApp();
    }, async (rec) => {
      try {
        const format = state.settings.format === 'original' ? (rec.type.split('/')[1] || 'png') : state.settings.format;
        const canvas = renderForExport(rec);
        const mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/avif';
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
          } catch {
            // fallback: copy data url
            try { await navigator.clipboard.writeText(canvas.toDataURL(mime, state.settings.quality / 100)); } catch {}
          }
        }, mime, state.settings.quality / 100);
      } catch (e) {
        console.error('Copy failed', e);
      }
    });

    // Bulk rename preview
    const previews = state.records.map((rec, i) => ({
      originalName: rec.name,
      previewName: buildFilename(state.settings.pattern, rec.name, i + 1, state.settings.format, state.settings.customPattern),
    }));
    renderBulkRenamePreview(bulkPreview, previews);
  } else {
    dropzone.classList.remove('hidden');
    grid.innerHTML = '';
    bulkPreview.innerHTML = '';
  }
}

const debouncedRender = debounce(renderApp, 150);

function renderForExport(rec: ImageRecord): HTMLCanvasElement {
  let srcCanvas = rec.canvas;
  const crop = state.perImageCrop[rec.id];
  if (crop) {
    srcCanvas = applyCrop(srcCanvas, clampCrop(crop, srcCanvas.width, srcCanvas.height));
  }
  const recordLike = { width: srcCanvas.width, height: srcCanvas.height, canvas: srcCanvas };
  const resized = renderResized(recordLike as any, state.settings.mode, state.settings.width, state.settings.height, state.settings.quality);
  return resized;
}

async function doExportZip(): Promise<void> {
  if (state.records.length === 0) return;
  const progress = document.getElementById('progress')!;
  const items: ExportItem[] = [];
  for (let i = 0; i < state.records.length; i++) {
    const rec = state.records[i];
    if (rec.error) continue;
    const canvas = renderForExport(rec);
    const format = state.settings.format === 'original' ? (rec.type.split('/')[1] || 'png') : state.settings.format;
    items.push({
      canvas,
      originalName: rec.name,
      format,
      quality: state.settings.quality,
      pattern: state.settings.pattern,
      customPattern: state.settings.customPattern,
      index: i + 1,
    });
  }
  if (items.length === 0) return;

  renderProgress(progress, 0, items.length);
  try {
    const zipBlob = await exportZip(items, (p) => renderProgress(progress, p.current, p.total));
    renderProgress(progress, items.length, items.length);
    triggerDownload(zipBlob, 'pixtrim-export.zip');
  } catch (e) {
    console.error('ZIP export failed', e);
  } finally {
    setTimeout(() => clearProgress(progress), 1500);
  }
}

function init(): void {
  const hashSettings = settingsFromHash();
  const stored = loadSettings();
  state.settings = { ...DEFAULT_SETTINGS, ...stored, ...(hashSettings || {}) };
  initTheme(state.settings.theme);

  // Apply URL hash to address bar if present
  if (hashSettings) {
    history.replaceState(null, '', encodeSettingsHash(state.settings));
  }

  registerShortcuts(doExportZip);
  document.addEventListener('pixtrim:export-zip', () => { doExportZip(); });

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modals = document.querySelectorAll('.crop-modal');
      modals.forEach((m) => m.remove());
    }
  });

  renderApp();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}

export { state, renderApp, doExportZip, renderForExport };
