export type ResizeMode = 'exact' | 'contain' | 'cover' | 'percentage';
export type OutputFormat = 'original' | 'jpeg' | 'webp' | 'png' | 'avif';
export type FilenamePattern = 'pictura_xxx' | 'original_resized' | 'custom_{name}' | 'original';

export interface Settings {
  targetWidth: number;
  targetHeight: number;
  ratioLocked: boolean;
  resizeMode: ResizeMode;
  outputFormat: OutputFormat;
  quality: number;
  filenamePattern: FilenamePattern;
  customName: string;
  theme: 'light' | 'dark';
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageRecord {
  id: string;
  file: File;
  name: string;
  originalName: string;
  type: string;
  size: number;
  width: number;
  height: number;
  orientation: number | null;
  canvas: HTMLCanvasElement;
  dataUrl: string;
  error?: string;
  crop?: CropRect;
}