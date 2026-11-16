import type { ImageRecord } from '../engine/image-loader';
import type { Settings } from '../engine/settings';
import { resizeToTarget } from '../engine/resize';
import { getFormatInfo } from '../engine/formats';

export interface GridPreviewUpdate {
  recordId: string;
  width: number;
  height: number;
  url: string;
}

export function renderThumbnailGrid(
  container: HTMLElement,
  records: ImageRecord[],
  settings: Settings,
  onCropClick: (record: ImageRecord) => void,
  onRemove: (id: string) => void,
  onCopy: (record: ImageRecord) => void
): void {
  container.innerHTML = '';

  for (const rec of records) {
    const card = document.createElement('div');
    card.className = 'thumb-card';
    card.style.cssText = 'display:flex;flex-direction:column;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg-secondary);min-width:180px;max-width:220px';

    const previewCanvas = resizeToTarget(rec, settings.mode, settings.width, settings.height, settings.quality);
    const previewUrl = previewCanvas.toDataURL('image/png');

    const img = document.createElement('img');
    img.src = previewUrl;
    img.alt = rec.name;
    img.style.cssText = 'width:100%;max-height:120px;object-fit:contain;background:var(--bg);border-radius:4px;margin-bottom:6px;cursor:pointer';
    img.addEventListener('click', () => onCropClick(rec));

    const meta = document.createElement('div');
    meta.className = 'thumb-meta';
    const sizeStr = rec.size < 1024 ? `${rec.size} B` : rec.size < 1024 * 1024 ? `${(rec.size / 1024).toFixed(1)} KB` : `${(rec.size / (1024 * 1024)).toFixed(2)} MB`;
    const formatLabel = getFormatInfo(rec.type.replace('image/', ''))?.label || rec.type.split('/')[1]?.toUpperCase() || 'IMG';
    const orientBadge = rec.orientation && rec.orientation !== 1 ? ` <span style="color:var(--accent);font-size:11px">↻ ${rec.orientation}</span>` : '';

    meta.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${rec.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">
        ${rec.width}×${rec.height} <span style="background:var(--bg);padding:1px 4px;border-radius:3px;font-size:10px">${formatLabel}</span> ${sizeStr}${orientBadge}
      </div>
    `;

    if (rec.error) {
      const warn = document.createElement('div');
      warn.style.cssText = 'margin-top:4px;font-size:11px;color:#dc2626';
      warn.textContent = `⚠️ ${rec.error}`;
      meta.appendChild(warn);
    }

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:4px;margin-top:6px';
    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'Copy';
    btnCopy.className = 'btn';
    btnCopy.style.cssText = 'flex:1;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font-size:11px;cursor:pointer';
    btnCopy.addEventListener('click', () => onCopy(rec));
    const btnRemove = document.createElement('button');
    btnRemove.textContent = '✕';
    btnRemove.className = 'btn';
    btnRemove.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font-size:11px;cursor:pointer';
    btnRemove.addEventListener('click', () => onRemove(rec.id));
    actions.appendChild(btnCopy);
    actions.appendChild(btnRemove);

    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(actions);
    container.appendChild(card);
  }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: any[]): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  } as T;
}
