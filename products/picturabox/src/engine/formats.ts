export interface OutputFormatInfo {
  id: string;
  label: string;
  mime: string;
  ext: string;
  lossy: boolean;
  supported: boolean;
  gated?: string;
}

let cachedSupport: Record<string, boolean> | null = null;

function probeCanvasMime(mime: string): boolean {
  if (typeof document === 'undefined') return mime !== 'image/avif';
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    return c.toDataURL(mime, 0.9).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

export function detectFormatSupport(): Record<string, boolean> {
  if (cachedSupport) return cachedSupport;
  cachedSupport = {
    jpeg: true,
    webp: probeCanvasMime('image/webp'),
    png: true,
    avif: probeCanvasMime('image/avif'),
  };
  return cachedSupport;
}

export function resetFormatSupportCache(): void {
  cachedSupport = null;
}

export function getOutputFormats(): OutputFormatInfo[] {
  const support = detectFormatSupport();
  return [
    { id: 'original', label: 'Original', mime: '', ext: '', lossy: false, supported: true },
    { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', lossy: true, supported: support.jpeg },
    { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true, supported: support.webp },
    { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', lossy: false, supported: true },
    { id: 'avif', label: 'AVIF', mime: 'image/avif', ext: 'avif', lossy: true, supported: support.avif, gated: 'AVIF output requires a browser with AVIF encoding support' },
  ];
}

export function getFormatInfo(id: string): OutputFormatInfo | undefined {
  return getOutputFormats().find(f => f.id === id);
}

export function isLossyFormat(id: string): boolean {
  if (id === 'jpeg' || id === 'webp' || id === 'avif') return true;
  return false;
}