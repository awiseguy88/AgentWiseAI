export type Mode = 'encode' | 'decode';
export type Variant = 'standard' | 'url-safe';
export type Charset =
  | 'utf-8'
  | 'ascii'
  | 'iso-8859-1'
  | 'cp1252'
  | 'utf-16-le'
  | 'utf-16-be';
export type Newline = 'lf' | 'crlf';
export type WrapMode = 'none' | 'mime76';

export type EncodeOptions = {
  variant: Variant;
  charset: Charset;
  newline: Newline;
  wrap: WrapMode;
  perLine: boolean;
  live: boolean;
};

export type DecodeOptions = {
  variant: Variant;
  charset: Charset;
  strict: boolean;
  autoDetect: boolean;
};

export type DecodeResult =
  | { ok: true; bytes: Uint8Array; detectedVariant: Variant; warnings: string[] }
  | { ok: false; error: string; detectedVariant?: Variant };

export type EncodeResult =
  | { ok: true; text: string; bytes: Uint8Array; warnings: string[] }
  | { ok: false; error: string };

export type FileEntry = {
  id: string;
  name: string;
  size: number;
  mime: string;
  data: Uint8Array;
  encoded: string;
  hash: string;
};