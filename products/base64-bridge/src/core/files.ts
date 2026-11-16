// Base64 Bridge — file handling, download, and ZIP export.
// Uses FileReader for reading, Blob + URL.createObjectURL for downloads.
// Minimal store-only ZIP writer (no compression, CRC32 for integrity).

import type { FileEntry } from '../types';

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function readFileAsText(file: File, encoding: string = 'utf-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file as text'));
    reader.readAsText(file, encoding);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoking to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type: string = 'text/plain'): void {
  downloadBlob(new Blob([text], { type }), filename);
}

export function downloadBytes(bytes: Uint8Array, filename: string, type: string = 'application/octet-stream'): void {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  downloadBlob(new Blob([copy.buffer as ArrayBuffer], { type }), filename);
}

// ----- CRC32 (for ZIP integrity) -----
const CRC32_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ----- Minimal store-only ZIP writer -----
export interface ZipEntry {
  name: string;
  data: Uint8Array;
  comment?: string;
}

function writeUInt32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function writeUInt16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function dosDateTime(date: Date = new Date()): { date: number; time: number } {
  const year = date.getFullYear() - 1980;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds() >> 1;
  const dosDate = (year << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { date: dosDate, time: dosTime };
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const now = new Date();
  const { date, time } = dosDateTime(now);

  // Calculate sizes
  const localHeaders: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  const fileData: Uint8Array[] = [];
  const localOffsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const commentBytes = new TextEncoder().encode(entry.comment || '');
    const crc = crc32(entry.data);
    const compressedSize = entry.data.length;
    const uncompressedSize = entry.data.length;

    // Local file header (30 bytes + name)
    const localHeaderSize = 30 + nameBytes.length;
    const localHeader = new Uint8Array(localHeaderSize);
    const lhView = new DataView(localHeader.buffer);
    writeUInt32LE(lhView, 0, 0x04034b50); // signature
    writeUInt16LE(lhView, 4, 20); // version needed
    writeUInt16LE(lhView, 6, 0); // general purpose flag
    writeUInt16LE(lhView, 8, 0); // compression method (0 = store)
    writeUInt16LE(lhView, 10, time); // mod time
    writeUInt16LE(lhView, 12, date); // mod date
    writeUInt32LE(lhView, 14, crc); // crc32
    writeUInt32LE(lhView, 18, compressedSize);
    writeUInt32LE(lhView, 22, uncompressedSize);
    writeUInt16LE(lhView, 26, nameBytes.length); // filename length
    writeUInt16LE(lhView, 28, 0); // extra field length
    localHeader.set(nameBytes, 30);

    // Central directory entry (46 bytes + name + comment)
    const centralSize = 46 + nameBytes.length + commentBytes.length;
    const centralDir = new Uint8Array(centralSize);
    const cdView = new DataView(centralDir.buffer);
    writeUInt32LE(cdView, 0, 0x02014b50); // signature
    writeUInt16LE(cdView, 4, 20); // version made by
    writeUInt16LE(cdView, 6, 20); // version needed
    writeUInt16LE(cdView, 8, 0); // general purpose flag
    writeUInt16LE(cdView, 10, 0); // compression method
    writeUInt16LE(cdView, 12, time); // mod time
    writeUInt16LE(cdView, 14, date); // mod date
    writeUInt32LE(cdView, 16, crc);
    writeUInt32LE(cdView, 20, compressedSize);
    writeUInt32LE(cdView, 24, uncompressedSize);
    writeUInt16LE(cdView, 28, nameBytes.length);
    writeUInt16LE(cdView, 30, 0); // extra field length
    writeUInt16LE(cdView, 32, commentBytes.length);
    writeUInt16LE(cdView, 34, 0); // disk number start
    writeUInt16LE(cdView, 36, 0); // internal file attributes
    writeUInt32LE(cdView, 38, 0); // external file attributes
    writeUInt32LE(cdView, 42, offset); // local header offset
    centralDir.set(nameBytes, 46);
    centralDir.set(commentBytes, 46 + nameBytes.length);

    localHeaders.push(localHeader);
    centralDirs.push(centralDir);
    fileData.push(entry.data);
    localOffsets.push(offset);
    offset += localHeaderSize + entry.data.length;
  }

  const centralDirOffset = offset;
  const centralDirData = new Uint8Array(centralDirs.reduce((sum, c) => sum + c.length, 0));
  let pos = 0;
  for (const c of centralDirs) {
    centralDirData.set(c, pos);
    pos += c.length;
  }
  const centralDirSize = centralDirData.length;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeUInt32LE(eocdView, 0, 0x06054b50); // signature
  writeUInt16LE(eocdView, 4, 0); // number of this disk
  writeUInt16LE(eocdView, 6, 0); // disk where central dir starts
  writeUInt16LE(eocdView, 8, entries.length); // entries on this disk
  writeUInt16LE(eocdView, 10, entries.length); // total entries
  writeUInt32LE(eocdView, 12, centralDirSize); // size of central directory
  writeUInt32LE(eocdView, 16, centralDirOffset); // offset of central directory
  writeUInt16LE(eocdView, 20, 0); // comment length

  // Assemble final ZIP
  const totalSize = offset + centralDirSize + eocd.length;
  const zip = new Uint8Array(totalSize);
  let outPos = 0;

  for (let i = 0; i < entries.length; i++) {
    zip.set(localHeaders[i], outPos);
    outPos += localHeaders[i].length;
    zip.set(fileData[i], outPos);
    outPos += fileData[i].length;
  }
  zip.set(centralDirData, outPos);
  outPos += centralDirSize;
  zip.set(eocd, outPos);

  return zip;
}

// ----- Hash for file entries (SHA-256 when available, else CRC32 fallback) -----
async function sha256Hex(data: Uint8Array): Promise<string> {
  try {
    const copy = new Uint8Array(data.length);
    copy.set(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', copy.buffer as ArrayBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: CRC32 (8 hex chars)
    return crc32(data).toString(16).padStart(8, '0');
  }
}

export async function computeFileHash(data: Uint8Array): Promise<string> {
  return sha256Hex(data);
}

export function guessMimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() || '';
  const mimes: Record<string, string> = {
    txt: 'text/plain',
    json: 'application/json',
    js: 'application/javascript',
    ts: 'application/typescript',
    html: 'text/html',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    pdf: 'application/pdf',
    zip: 'application/zip',
    gz: 'application/gzip',
    md: 'text/markdown',
    xml: 'application/xml',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    csv: 'text/csv',
  };
  return mimes[ext] || 'application/octet-stream';
}

export function base64ToFilename(name: string, variant: 'standard' | 'url-safe'): string {
  const ext = variant === 'url-safe' ? '.b64url' : '.b64';
  if (name.toLowerCase().endsWith('.b64') || name.toLowerCase().endsWith('.b64url')) {
    return name;
  }
  return name + ext;
}

export function decodedFilename(encodedName: string): string {
  // If encoded name ends with .b64 or .b64url, strip it; else append .decoded
  if (encodedName.toLowerCase().endsWith('.b64url')) return encodedName.slice(0, -7);
  if (encodedName.toLowerCase().endsWith('.b64')) return encodedName.slice(0, -4);
  return encodedName + '.decoded';
}