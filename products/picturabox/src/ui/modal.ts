import type { CropRect, ImageRecord } from '../engine/types';

export function openCropModal(
  record: ImageRecord,
  onApply: (rect: CropRect) => void,
  onCancel: () => void
): void {
  const root = document.getElementById('modal-root');
  if (!root) return;

  const rect: CropRect = { x: 0, y: 0, w: record.width, h: record.height };

  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Crop image">
        <h3>Crop image</h3>
        <p class="muted">${record.name} — drag the box to select the region to keep.</p>
        <div class="crop-stage" id="crop-stage">
          <img id="crop-img" src="${record.dataUrl}" alt="crop" />
          <div class="crop-rect" id="crop-rect"></div>
        </div>
        <div class="modal-actions">
          <button class="btn" id="crop-cancel" type="button">Cancel</button>
          <button class="btn primary" id="crop-apply" type="button">Apply crop</button>
        </div>
      </div>
    </div>
  `;

  const stage = document.getElementById('crop-stage') as HTMLElement;
  const img = document.getElementById('crop-img') as HTMLImageElement;
  const cropRect = document.getElementById('crop-rect') as HTMLElement;

  const toNatural = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = stage.getBoundingClientRect();
    const dispW = img.clientWidth || 1;
    const dispH = img.clientHeight || 1;
    const x = ((clientX - r.left) / dispW) * record.width;
    const y = ((clientY - r.top) / dispH) * record.height;
    return { x, y };
  };

  const renderRect = () => {
    const scale = img.clientWidth / record.width;
    cropRect.style.left = `${rect.x * scale}px`;
    cropRect.style.top = `${rect.y * scale}px`;
    cropRect.style.width = `${rect.w * scale}px`;
    cropRect.style.height = `${rect.h * scale}px`;
  };
  img.onload = renderRect;
  renderRect();

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startRect: CropRect = { ...rect };

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startRect = { ...rect };
    stage.setPointerCapture?.(e.pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const cur = toNatural(e.clientX, e.clientY);
    const dx = cur.x - toNatural(startX, startY).x;
    const dy = cur.y - toNatural(startX, startY).y;
    const nx = Math.max(0, Math.min(record.width - 1, Math.round(startRect.x + dx)));
    const ny = Math.max(0, Math.min(record.height - 1, Math.round(startRect.y + dy)));
    const nw = Math.max(1, Math.min(record.width - startRect.x, Math.round(startRect.w + dx)));
    const nh = Math.max(1, Math.min(record.height - startRect.y, Math.round(startRect.h + dy)));
    rect.x = nx; rect.y = ny; rect.w = nw; rect.h = nh;
    renderRect();
  });

  stage.addEventListener('pointerup', () => { dragging = false; });

  document.getElementById('crop-cancel')?.addEventListener('click', () => {
    root.innerHTML = '';
    onCancel();
  });
  document.getElementById('crop-apply')?.addEventListener('click', () => {
    root.innerHTML = '';
    onApply({ ...rect });
  });

  const backdrop = document.getElementById('modal-backdrop')!;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      root.innerHTML = '';
      onCancel();
    }
  });
}

export function registerShortcuts(onExport: () => void): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('modal-root')!.innerHTML = '';
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onExport();
    }
  });
}