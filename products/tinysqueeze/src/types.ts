export type ProcessingState = 'queued' | 'compressing' | 'done' | 'error';

export interface ImageItem {
  id: string;
  name: string;          // original filename
  size: number;          // original byte size
  type: string;          // MIME type (image/jpeg or image/png)
  width: number | null;  // original width in pixels (null when undecodable)
  height: number | null; // original height in pixels (null when undecodable)
  quality: number;       // per-item quality override (1-100); null = use global default
  status: ProcessingState;
  error: string | null;
  compressedSize: number | null;
  savingsPercent: number | null;
  compressedName: string | null;
  compressedBlobUrl: string | null; // revocable blob URL for preview/download
  qualityOverride: number | null;   // explicit per-item override when set by user
  isDefaultQuality: boolean;        // true when item uses the global default
}

export interface CompressionResult {
  ok: boolean;
  compressedSize?: number;
  savingsPercent?: number;
  compressedName?: string;
  blob?: Blob;
  error?: string;
}

export interface BatchTotals {
  itemCount: number;
  doneCount: number;
  errorCount: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  totalSavingsPercent: number;
}

export interface ValidationError {
  code: 'unsupported-type' | 'too-large' | 'too-many-files' | 'corrupt' | 'empty-selection';
  message: string;
  file?: File;
}