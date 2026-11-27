import type { SourceImage } from './types';
import { loadSourceImage } from './loader';
import markSvgUrl from '../../fixtures/mark.svg?url';
import markPngUrl from '../../fixtures/mark-1024.png?url';
import photoPngUrl from '../../fixtures/photo-sample.png?url';

export interface SampleDef {
  id: string;
  label: string;
  url: string;
  name: string;
}

export const SAMPLES: SampleDef[] = [
  { id: 'mark-svg', label: 'Vector mark (SVG)', url: markSvgUrl, name: 'mark.svg' },
  { id: 'mark-png', label: 'Mark raster (1024 PNG)', url: markPngUrl, name: 'mark-1024.png' },
  { id: 'photo', label: 'Photo tile (PNG)', url: photoPngUrl, name: 'photo-sample.png' },
];

/** Fetch a bundled sample and decode it into a SourceImage. */
export async function loadSample(id: string): Promise<SourceImage> {
  const def = SAMPLES.find((s) => s.id === id) || SAMPLES[0];
  const res = await fetch(def.url);
  if (!res.ok) throw new Error(`Could not load sample: HTTP ${res.status}`);
  const blob = await res.blob();
  const type = blob.type || (def.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
  const file = new File([blob], def.name, { type });
  return loadSourceImage(file);
}