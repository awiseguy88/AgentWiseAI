export interface Capabilities {
  avif: boolean;
  webp: boolean;
  jpeg: boolean;
  fileSystemAccess: boolean;
}

let cached: Capabilities | null = null;

export async function detectCapabilities(): Promise<Capabilities> {
  if (cached) return cached;
  const caps: Capabilities = {
    avif: false,
    webp: false,
    jpeg: false,
    fileSystemAccess: false,
  };
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillRect(0, 0, 1, 1);
      const toBlob = (type: string) =>
        new Promise<boolean>((resolve) => {
          try {
            canvas.toBlob((blob) => resolve(!!blob && blob.type === type), type);
          } catch {
            resolve(false);
          }
        });
      [caps.jpeg, caps.webp, caps.avif] = await Promise.all([
        toBlob('image/jpeg'),
        toBlob('image/webp'),
        toBlob('image/avif'),
      ]);
    }
  } catch {
    // ignore
  }
  try {
    caps.fileSystemAccess = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  } catch {
    caps.fileSystemAccess = false;
  }
  cached = caps;
  return caps;
}

export function supportsAiHooks(): boolean {
  // Local model hooks are optional and degrade gracefully; never block core flows.
  return false;
}