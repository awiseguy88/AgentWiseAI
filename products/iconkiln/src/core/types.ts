export type IconType = 'multi' | 'per-size';

export type BackgroundMode = 'transparent' | 'flatten';

export interface SizeSpec {
  w: number;
  h: number;
}

export interface SourceImage {
  name: string;
  type: string;
  bytes: number;
  width: number;
  height: number;
  /** Decoded, drawable source. For SVG this is a rasterized canvas at native size. */
  drawable: CanvasImageSource;
  /** Natural width/height of the drawable in CSS pixels. */
  drawWidth: number;
  drawHeight: number;
  /** Object URL to revoke when the source is replaced. */
  objectUrl?: string;
}

export interface GenerateSettings {
  iconType: IconType;
  sizes: SizeSpec[];
  background: BackgroundMode;
  flattenColor: string;
}

export interface GeneratedAsset {
  /** File name inside the export, e.g. favicon.ico, icon-32x32.png, apple-touch-icon.png */
  name: string;
  /** Role used by the pack manifest builder. */
  role: string;
  width: number;
  height: number;
  /** Encoded bytes for this asset (PNG or ICO). */
  bytes: Uint8Array;
  mime: string;
}