import type { ImageRecord } from '../engine/image-loader';
import type { CropRect } from '../engine/crop';
import { clampCrop, applyCrop, cropRectFromDrag } from '../engine/crop';

export interface CropModalResult {
  canvas: HTMLCanvasElement;
  rect: CropRect;
}

export function openCropModal(
  record: ImageRecord,
  onApply: (result: CropModalResult) => void,
  onClose: () => void
): void {
  const modal = document.createElement('div');
  modal.className = 'crop-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--bg);border-radius:12px;padding:20px;max-width:90vw;max-height:90vh;overflow:auto';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:700;margin-bottom:12px;color:var(--fg)';
  title.textContent = `Crop — ${record.name}`;

  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative;display:inline-block;border:1px solid var(--border);border-radius:6px;overflow:hidden';

  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = Math.min(800, record.width);
  displayCanvas.height = Math.round(displayCanvas.width * record.height / record.width);
  const dctx = displayCanvas.getContext('2d')!;
  dctx.drawImage(record.canvas, 0, 0, displayCanvas.width, displayCanvas.height);
  canvasWrap.appendChild(displayCanvas);

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:absolute;left:0;top:0;width:${displayCanvas.width}px;height:${displayCanvas.height}px;border:2px dashed var(--accent);pointer-events:none;display:none`;
  canvasWrap.appendChild(overlay);

  let cropStartX = 0;
  let cropStartY = 0;
  let cropEndX = 0;
  let cropEndY = 0;

  function updateOverlay(): void {
    const scaleX = record.width / displayCanvas.width;
    const scaleY = record.height / displayCanvas.height;
    const x = Math.min(cropStartX, cropEndX);
    const y = Math.min(cropStartY, cropEndY);
    const w = Math.abs(cropEndX - cropStartX);
    const h = Math.abs(cropEndY - cropStartY);
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;
    overlay.style.display = w > 0 && h > 0 ? 'block' : 'none';
    void scaleX; void scaleY;
  }

  displayCanvas.addEventListener('mousedown', (e) => {
    const rect = displayCanvas.getBoundingClientRect();
    cropStartX = e.clientX - rect.left;
    cropStartY = e.clientY - rect.top;
    cropEndX = cropStartX;
    cropEndY = cropStartY;
    const move = (ev: MouseEvent) => {
      cropEndX = ev.clientX - rect.left;
      cropEndY = ev.clientY - rect.top;
      updateOverlay();
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;margin-top:12px';
  const btnApply = document.createElement('button');
  btnApply.className = 'btn primary';
  btnApply.textContent = 'Apply Crop';
  btnApply.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:var(--accent);color:white;font-weight:600;cursor:pointer';
  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn';
  btnCancel.textContent = 'Cancel';
  btnCancel.style.cssText = 'padding:8px 16px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--fg);cursor:pointer';

  controls.appendChild(btnApply);
  controls.appendChild(btnCancel);

  function applyCropResult(): void {
    if (cropEndX === 0 && cropEndY === 0) {
      onClose();
      return;
    }
    const scaleX = record.width / displayCanvas.width;
    const scaleY = record.height / displayCanvas.height;
    const x = Math.min(cropStartX, cropEndX) * scaleX;
    const y = Math.min(cropStartY, cropEndY) * scaleY;
    const w = Math.abs(cropEndX - cropStartX) * scaleX;
    const h = Math.abs(cropEndY - cropStartY) * scaleY;
    const rect = clampCrop({ x, y, w: Math.max(1, w), h: Math.max(1, h) }, record.width, record.height);
    const cropped = applyCrop(record.canvas, rect);
    onApply({ canvas: cropped, rect });
    document.body.removeChild(modal);
  }

  btnApply.addEventListener('click', applyCropResult);
  btnCancel.addEventListener('click', () => {
    document.body.removeChild(modal);
    onClose();
  });

  box.appendChild(title);
  box.appendChild(canvasWrap);
  box.appendChild(controls);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

export function closeModalOnEscape(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modals = document.querySelectorAll('.crop-modal');
      modals.forEach((m) => m.remove());
    }
  });
}
