export type CropMode = 'contain' | 'cover' | 'custom';
export type OutputFormat = 'original' | 'jpeg' | 'webp' | 'avif';
export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface FocalPoint { x: number; y: number; } // 0..1
export interface CropRect { x: number; y: number; w: number; h: number; } // source pixels

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  font: string;
  size: number;
  color: string;
  position: WatermarkPosition;
  opacity: number; // 0..1
  angle: number; // degrees
  imageDataUrl?: string | null;
  imageScale: number; // 0..1 of output width
}

export interface BorderSettings {
  enabled: boolean;
  color: string;
  thickness: number; // px
}

export interface AISettings {
  backgroundRemoval: boolean;
  upscale: 1 | 2 | 3 | 4;
}

export interface Settings {
  targetWidth: number | null;
  targetHeight: number | null;
  lockAspect: boolean;
  cropMode: CropMode;
  outputFormat: OutputFormat;
  quality: number; // 0..100
  renamePattern: string;
  renameStart: number;
  highQualityResize: boolean;
  watermark: WatermarkSettings;
  border: BorderSettings;
  ai: AISettings;
}

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  originalName: string;
  size: number;
  width: number;
  height: number;
  thumbUrl: string;
  focal: FocalPoint;
  customCrop?: CropRect | null;
  status: 'queued' | 'processing' | 'done' | 'error';
  progress: number; // 0..1
  error?: string;
  outputBlob?: Blob;
  outputName?: string;
}

export interface ProcessResult {
  id: string;
  ok: boolean;
  blob?: Blob;
  name?: string;
  error?: string;
}

export const defaultSettings = (): Settings => ({
  targetWidth: 800,
  targetHeight: null,
  lockAspect: true,
  cropMode: 'contain',
  outputFormat: 'webp',
  quality: 85,
  renamePattern: 'fitframe_xxx',
  renameStart: 1,
  highQualityResize: false,
  watermark: {
    enabled: false,
    text: '',
    font: 'sans-serif',
    size: 32,
    color: '#ffffff',
    position: 'bottom-right',
    opacity: 0.3,
    angle: 0,
    imageDataUrl: null,
    imageScale: 0.25,
  },
  border: { enabled: false, color: '#000000', thickness: 10 },
  ai: { backgroundRemoval: false, upscale: 1 },
});
