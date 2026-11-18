import './styles.css';
import type { ImageItem } from './types.ts';
import {
  DEFAULT_QUALITY,
  MAX_FILE_BYTES,
  MAX_FILES,
  isSupportedType,
  clampQuality,
  stem,
} from './constants.ts';
import { loadImage, compressImage } from './core/compress.ts';
import { formatBytes, formatPercent, computeSavingsPercent } from './core/format.ts';
import { downloadBlob, downloadAllAsZip, downloadAllSequentially } from './core/zip.ts';

// ---------------- State ----------------
let items: ImageItem[] = [];
let globalQuality = DEFAULT_QUALITY;

function makeItem(file: File): ImageItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    type: file.type.toLowerCase(),
    width: null,
    height: null,
    quality: globalQuality,
    status: 'queued',
    error: null,
    compressedSize: null,
    savingsPercent: null,
    compressedName: null,
    compressedBlobUrl: null,
    qualityOverride: null,
    isDefaultQuality: true,
  };
}

// ---------------- Validate ----------------
export function validateFiles(files: FileList | File[]): { accepted: File[]; errors: string[] } {
  const arr = Array.from(files);
  const accepted: File[] = [];
  const errors: string[] = [];

  if (arr.length === 0) {
    errors.push('No files selected.');
    return { accepted, errors };
  }

  if (arr.length > MAX_FILES) {
    errors.push(`Maximum ${MAX_FILES} files per batch. You selected ${arr.length}.`);
  }

  let acceptedCount = 0;
  for (const file of arr) {
    if (acceptedCount >= MAX_FILES) break;
    if (!isSupportedType(file.type)) {
      errors.push(`Unsupported file type: ${file.name} (${file.type || 'unknown'})`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`File too large: ${file.name} (${formatBytes(file.size)} > ${formatBytes(MAX_FILE_BYTES)})`);
      continue;
    }
    accepted.push(file);
    acceptedCount += 1;
  }

  return { accepted, errors };
}

// ---------------- Compress ----------------
export async function compressItem(item: ImageItem): Promise<void> {
  item.status = 'compressing';
  item.error = null;
  render();

  try {
    const file = new File([], item.name, { type: item.type });
    // We need the original File to compress; store a reference
    const originalFile = (item as any)._file as File | undefined;
    const useFile = originalFile ?? file;

    const q = item.isDefaultQuality ? globalQuality : (item.qualityOverride ?? globalQuality);
    const result = await compressImage(useFile, q);

    item.compressedSize = result.size;
    item.compressedName = result.name;
    item.savingsPercent = computeSavingsPercent(item.size, result.size);
    item.status = 'done';
    if (result.blob) {
      if (item.compressedBlobUrl) URL.revokeObjectURL(item.compressedBlobUrl);
      item.compressedBlobUrl = URL.createObjectURL(result.blob);
    }
  } catch (err) {
    item.status = 'error';
    item.error = err instanceof Error ? err.message : 'Compression failed';
  }
  render();
}

async function compressAll(): Promise<void> {
  for (const item of items) {
    if (item.status === 'queued' || item.status === 'error') {
      await compressItem(item);
    }
  }
}

async function recompressItem(item: ImageItem): Promise<void> {
  item.status = 'queued';
  await compressItem(item);
}

// ---------------- Load dimensions ----------------
async function loadItemDimensions(item: ImageItem, file: File): Promise<void> {
  try {
    const img = await loadImage(file);
    item.width = img.naturalWidth;
    item.height = img.naturalHeight;
  } catch {
    item.width = null;
    item.height = null;
  }
}

// ---------------- Add files ----------------
export async function addFiles(files: FileList | File[]): Promise<void> {
  const { accepted, errors } = validateFiles(files);
  for (const err of errors) {
    showError(err);
  }
  for (const file of accepted) {
    const item = makeItem(file);
    (item as any)._file = file; // store File reference for compression
    items.push(item);
    await loadItemDimensions(item, file);
  }
  render();
}

// ---------------- Render ----------------
function render(): void {
  const listEl = document.getElementById('item-list')!;
  const emptyEl = document.getElementById('empty-state')!;
  const totalsEl = document.getElementById('totals')!;
  const toolbarEl = document.getElementById('toolbar')!;

  listEl.innerHTML = '';
  if (items.length === 0) {
    emptyEl.classList.remove('hidden');
    totalsEl.innerHTML = '';
    toolbarEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  toolbarEl.classList.remove('hidden');

  let totalOriginal = 0;
  let totalCompressed = 0;
  let doneCount = 0;
  let errorCount = 0;

  for (const item of items) {
    const div = document.createElement('div');
    div.className = `item ${item.status}`;
    if (item.error) div.classList.add('error');

    // Thumbnail
    let thumb: HTMLElement;
    if (item.compressedBlobUrl && item.status === 'done') {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = item.compressedBlobUrl;
      img.alt = item.name;
      thumb = img;
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'thumb-placeholder';
      placeholder.textContent = 'preview';
      thumb = placeholder;
    }

    // Info
    const info = document.createElement('div');
    info.className = 'item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'item-name';
    nameEl.textContent = item.name;
    nameEl.title = item.name;
    const metaEl = document.createElement('div');
    metaEl.className = 'item-meta';
    const dimText = item.width != null && item.height != null ? `${item.width}×${item.height}` : '—';
    const origSizeEl = document.createElement('span');
    origSizeEl.textContent = `Original: ${formatBytes(item.size)}`;
    const dimEl = document.createElement('span');
    dimEl.textContent = `Dimensions: ${dimText}`;
    metaEl.appendChild(origSizeEl);
    metaEl.appendChild(dimEl);
    info.appendChild(nameEl);
    info.appendChild(metaEl);

    // Quality control
    const qControl = document.createElement('div');
    qControl.className = 'quality-control';
    const qLabel = document.createElement('label');
    qLabel.textContent = 'Quality:';
    qLabel.htmlFor = `q-${item.id}`;
    const qSlider = document.createElement('input');
    qSlider.type = 'range';
    qSlider.min = '1';
    qSlider.max = '100';
    qSlider.id = `q-${item.id}`;
    const qNum = document.createElement('input');
    qNum.type = 'number';
    qNum.min = '1';
    qNum.max = '100';
    const qVal = item.isDefaultQuality ? globalQuality : (item.qualityOverride ?? globalQuality);
    qSlider.value = String(qVal);
    qNum.value = String(qVal);
    const updateQ = (v: number) => {
      const clamped = clampQuality(v);
      item.qualityOverride = clamped;
      item.isDefaultQuality = false;
      qSlider.value = String(clamped);
      qNum.value = String(clamped);
    };
    qSlider.addEventListener('input', () => updateQ(parseInt(qSlider.value, 10)));
    qNum.addEventListener('change', () => updateQ(parseInt(qNum.value, 10)));
    qControl.appendChild(qLabel);
    qControl.appendChild(qSlider);
    qControl.appendChild(qNum);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'actions';
    const btnCompress = document.createElement('button');
    btnCompress.textContent = 'Compress';
    btnCompress.disabled = item.status === 'compressing';
    btnCompress.addEventListener('click', () => recompressItem(item));
    const btnDownload = document.createElement('button');
    btnDownload.textContent = 'Download';
    btnDownload.disabled = item.status !== 'done' || !item.compressedBlobUrl;
    btnDownload.addEventListener('click', () => {
      if (item.compressedBlobUrl && item.compressedName) {
        fetch(item.compressedBlobUrl).then((r) => r.blob()).then((blob) => downloadBlob(blob, item.compressedName!));
      }
    });
    const btnRemove = document.createElement('button');
    btnRemove.className = 'danger';
    btnRemove.textContent = '×';
    btnRemove.title = 'Remove';
    btnRemove.addEventListener('click', () => {
      if (item.compressedBlobUrl) URL.revokeObjectURL(item.compressedBlobUrl);
      items = items.filter((i) => i.id !== item.id);
      render();
    });
    actions.appendChild(btnCompress);
    actions.appendChild(btnDownload);
    actions.appendChild(btnRemove);

    // Status badge
    const status = document.createElement('span');
    status.className = `status ${item.status}`;
    status.textContent = item.status;

    // Savings
    const savings = document.createElement('div');
    savings.className = 'savings';
    if (item.status === 'done' && item.savingsPercent != null && item.compressedSize != null) {
      const pct = item.savingsPercent;
      savings.textContent = `${pct >= 0 ? '−' : '+'}${Math.abs(Math.round(pct))}%`;
      if (pct < 0) savings.classList.add('negative');
      totalOriginal += item.size;
      totalCompressed += item.compressedSize;
      doneCount += 1;
    } else if (item.status === 'error') {
      savings.textContent = '';
      errorCount += 1;
    } else {
      savings.textContent = '';
    }

    // Error message
    let errorDiv: HTMLElement | null = null;
    if (item.error) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'item-error';
      errorDiv.textContent = item.error;
    }

    div.appendChild(thumb);
    div.appendChild(info);
    div.appendChild(qControl);
    div.appendChild(actions);
    div.appendChild(status);
    div.appendChild(savings);
    if (errorDiv) div.appendChild(errorDiv);
    listEl.appendChild(div);
  }

  // Totals
  if (doneCount > 0) {
    const totalSavings = computeSavingsPercent(totalOriginal, totalCompressed);
    totalsEl.innerHTML = `
      <strong>${doneCount}</strong> compressed,
      ${formatBytes(totalOriginal)} → <strong>${formatBytes(totalCompressed)}</strong>
      (save <strong>${formatPercent(totalSavings)}</strong>)
      ${errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? 's' : ''}` : ''}
    `;
  } else {
    totalsEl.textContent = `${items.length} item${items.length > 1 ? 's' : ''}`;
  }
}

function showError(msg: string): void {
  const listEl = document.getElementById('item-list')!;
  const div = document.createElement('div');
  div.className = 'item-error';
  div.style.marginBottom = '8px';
  div.textContent = msg;
  listEl.appendChild(div);
}

// ---------------- Download All ----------------
async function downloadAll(): Promise<void> {
  const done = items.filter((i) => i.status === 'done' && i.compressedBlobUrl && i.compressedName);
  if (done.length === 0) {
    showError('No compressed items to download.');
    return;
  }
  const zipItems = await Promise.all(
    done.map(async (i) => ({
      name: i.compressedName!,
      blob: await fetch(i.compressedBlobUrl!).then((r) => r.blob()),
    })),
  );
  try {
    await downloadAllAsZip(zipItems, 'tinysqueeze-compressed.zip');
  } catch {
    // Fallback to sequential
    await downloadAllSequentially(zipItems);
  }
}

// ---------------- Clear all ----------------
function clearAll(): void {
  for (const item of items) {
    if (item.compressedBlobUrl) URL.revokeObjectURL(item.compressedBlobUrl);
  }
  items = [];
  globalQuality = DEFAULT_QUALITY;
  render();
}

// ---------------- Init ----------------
function init(): void {
  document.getElementById('app')!.innerHTML = `
    <h1>TinySqueeze</h1>
    <p class="subtitle">Browser-based image compression. Drag, drop, compress.</p>
    <div class="privacy">Images are processed locally in your browser. Your files never leave your device.</div>
    <div class="dropzone" id="dropzone">
      <p>Drop images here or click to select</p>
      <small>JPEG / PNG · max 50 files · max 25 MB each</small>
    </div>
    <input type="file" id="file-input" multiple accept="image/jpeg,image/png" class="hidden">
    <div class="toolbar hidden" id="toolbar">
      <div class="toolbar-group">
        <label for="global-quality">Default quality:</label>
        <input type="range" id="global-quality" min="1" max="100" value="${DEFAULT_QUALITY}">
        <span id="global-quality-val">${DEFAULT_QUALITY}%</span>
      </div>
      <div class="toolbar-group">
        <button id="btn-compress-all">Compress All</button>
        <button id="btn-download-all">Download All</button>
        <button id="btn-clear" class="secondary">Clear All</button>
      </div>
      <div class="totals" id="totals"></div>
    </div>
    <div class="list" id="item-list"></div>
    <div class="empty-state" id="empty-state">No images selected yet.</div>
    <footer>
      <a href="https://aaronwiseai.com/" target="_blank" rel="noopener">AaronWiseAI</a> ·
      Part of the AaronWiseAI open-source tool collection.
    </footer>
  `;

  const dropzone = document.getElementById('dropzone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const globalQ = document.getElementById('global-quality') as HTMLInputElement;
  const globalQVal = document.getElementById('global-quality-val')!;
  const btnCompressAll = document.getElementById('btn-compress-all') as HTMLButtonElement;
  const btnDownloadAll = document.getElementById('btn-download-all') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;

  // File picker
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files) addFiles(fileInput.files);
    fileInput.value = '';
  });

  // Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  });

  // Global quality
  globalQ.addEventListener('input', () => {
    const v = parseInt(globalQ.value, 10);
    const clamped = clampQuality(v);
    globalQuality = clamped;
    globalQVal.textContent = `${clamped}%`;
    // Update items using default quality
    for (const item of items) {
      if (item.isDefaultQuality) {
        item.quality = clamped;
      }
    }
    render();
  });

  // Buttons
  btnCompressAll.addEventListener('click', () => {
    void compressAll();
  });
  btnDownloadAll.addEventListener('click', () => {
    void downloadAll();
  });
  btnClear.addEventListener('click', () => clearAll());

  render();
}

// ---------------- Start ----------------
if (typeof window !== 'undefined' && !window.location.pathname.includes('/tests/')) {
  window.addEventListener('DOMContentLoaded', init);
}