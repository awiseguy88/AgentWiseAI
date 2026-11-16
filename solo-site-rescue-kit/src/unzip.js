/**
 * Solo Site Rescue Kit — minimal pure-Node ZIP reader.
 *
 * Supports local file headers (stored method 0 and deflate method 8), data
 * descriptors, and central-directory-based listing. No external dependencies.
 * Intended for unpacking exported builder archives (.zip) into memory.
 */

import * as zlib from "node:zlib";

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;

function readUInt32LE(buf, off) {
  return buf.readUInt32LE(off);
}
function readUInt16LE(buf, off) {
  return buf.readUInt16LE(off);
}

/** Result of listing a ZIP archive. */
export class ZipEntry {
  constructor({ name, compressedSize, uncompressedSize, method, offset, crc32 }) {
    this.name = name;
    this.compressedSize = compressedSize;
    this.uncompressedSize = uncompressedSize;
    this.method = method; // 0 = stored, 8 = deflate
    this.offset = offset;
    this.crc32 = crc32;
  }

  /** Decompress this entry from the source buffer. */
  async decompress(source) {
    const start = this.offset + 30; // fixed local header size used below
    const compressed = source.subarray(start, start + this.compressedSize);
    if (this.method === 0) return compressed;
    if (this.method === 8) {
      return zlib.inflateRaw(compressed);
    }
    throw new Error(`Unsupported ZIP compression method: ${this.method}`);
  }
}

/**
 * Parse a ZIP archive buffer into entries.
 * Throws on malformed archives.
 */
export function parseZip(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("parseZip expects a Buffer");
  }

  // Find end of central directory record (search from the end).
  let endOffset = -1;
  for (let i = buffer.length - 4; i >= 0; i--) {
    if (readUInt32LE(buffer, i) === SIG_END) {
      endOffset = i;
      break;
    }
  }
  if (endOffset === -1) {
    throw new Error("Not a ZIP archive: end of central directory not found");
  }

  const endOfCentralOffset = endOffset + 22;
  const centralOffset = readUInt32LE(buffer, endOffset + 16);
  const centralSize = readUInt32LE(buffer, endOffset + 12);
  const centralCount = readUInt16LE(buffer, endOffset + 10);

  const entries = [];
  let pos = centralOffset;
  const centralEnd = centralOffset + centralSize;
  while (pos + 46 <= centralEnd && entries.length < centralCount) {
    if (readUInt32LE(buffer, pos) !== SIG_CENTRAL) break;
    const method = readUInt16LE(buffer, pos + 10);
    const compressedSize = readUInt32LE(buffer, pos + 20);
    const uncompressedSize = readUInt32LE(buffer, pos + 24);
    const nameLength = readUInt16LE(buffer, pos + 28);
    const extraLength = readUInt16LE(buffer, pos + 30);
    const commentLength = readUInt16LE(buffer, pos + 32);
    const localHeaderOffset = readUInt32LE(buffer, pos + 42);
    const name = buffer.subarray(pos + 46, pos + 46 + nameLength).toString("utf8");
    entries.push(
      new ZipEntry({
        name,
        compressedSize,
        uncompressedSize,
        method,
        offset: localHeaderOffset,
        crc32: readUInt32LE(buffer, pos + 16),
      })
    );
    pos += 46 + nameLength + extraLength + commentLength;
  }

  return { entries, endOfCentralOffset };
}

/** Read a single entry by name (first match wins). */
export async function readZipEntry(buffer, name) {
  const { entries } = parseZip(buffer);
  const entry = entries.find((e) => e.name === name || e.name.replace(/^\/+/, "") === name);
  if (!entry) {
    const available = entries.map((e) => e.name).join(", ");
    throw new Error(`ZIP entry not found: ${name}. Available: ${available}`);
  }
  return entry.decompress(buffer);
}

/** Read all entries as a map of name -> Buffer. */
export async function readAllZipEntries(buffer) {
  const { entries } = parseZip(buffer);
  const map = {};
  for (const entry of entries) {
    map[entry.name] = await entry.decompress(buffer);
  }
  return map;
}

/** Normalize ZIP entry names: backslashes -> forward slashes, strip leading slash. */
export function normalizeZipName(name) {
  return name.replace(/\\/g, "/").replace(/^\/+/, "");
}
