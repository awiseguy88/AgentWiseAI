import JSZip from 'jszip';
import type { SourceImage, GenerateSettings } from './types';
import { renderToCanvas } from './raster';
import { canvasToPngBytes } from './png';
import { assetBaseName } from './build';
import { encodeIco } from './ico';
import { planPack, buildManifest, buildReadme } from './pack';

export interface PackResult {
  blob: Blob;
  fileName: string;
  fileCount: number;
}

/**
 * Render every pack image, then assemble a ZIP containing the conventional
 * favicon/apple-touch/android-chrome assets, site.webmanifest, and README.txt.
 */
export async function buildPackZip(src: SourceImage, settings: GenerateSettings): Promise<PackResult> {
  const base = assetBaseName(src.name);
  const plan = planPack(base, settings.sizes);
  const zip = new JSZip();

  for (const img of plan.images) {
    const canvas = renderToCanvas(src, img.size.w, img.size.h, {
      background: settings.background,
      flattenColor: settings.flattenColor,
    });
    const png = await canvasToPngBytes(canvas);
    zip.file(img.name, png);
  }

  // If multi ico requested, also include favicon.ico in the pack.
  if (settings.iconType === 'multi') {
    const frames = [];
    for (const img of plan.images) {
      const canvas = renderToCanvas(src, img.size.w, img.size.h, {
        background: settings.background,
        flattenColor: settings.flattenColor,
      });
      const png = await canvasToPngBytes(canvas);
      frames.push({ width: img.size.w, height: img.size.h, png });
    }
    // Use a compact subset for the ico to keep it focused: favicon-ish sizes.
    const icoFrames = frames.filter((f) => f.width <= 64);
    const useFrames = icoFrames.length > 0 ? icoFrames : frames.slice(0, 4);
    zip.file('favicon.ico', encodeIco(useFrames));
  }

  const manifest = buildManifest(plan, base);
  zip.file(plan.manifestName, JSON.stringify(manifest, null, 2));
  zip.file(plan.readmeName, buildReadme(base, plan));

  const blob = await zip.generateAsync({ type: 'blob' });
  const fileCount = plan.images.length + 2 + (settings.iconType === 'multi' ? 1 : 0);
  return { blob, fileName: `${base}-icon-pack.zip`, fileCount };
}