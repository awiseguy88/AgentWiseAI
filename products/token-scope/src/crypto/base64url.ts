const BASE64URL_REGEX = /^[A-Za-z0-9_-]*={0,2}$/;

function getAtob(): (s: string) => string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob.bind(globalThis);
  }
  throw new Error('Base64 decoding is not available in this environment.');
}

function getBtoa(): (s: string) => string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa.bind(globalThis);
  }
  throw new Error('Base64 encoding is not available in this environment.');
}

/**
 * Decode a Base64URL string into raw bytes.
 * Throws a descriptive Error if the input contains invalid Base64URL syntax.
 */
export function base64urlToBytes(input: string): Uint8Array {
  if (typeof input !== 'string') {
    throw new Error('Invalid Base64URL input: expected a string.');
  }

  const hasPadding = input.endsWith('=');
  const unpadded = hasPadding ? input.replace(/=+$/, '') : input;

  if (unpadded.length === 0) {
    if (hasPadding && input !== '' && !BASE64URL_REGEX.test(input)) {
      throw new Error('Invalid Base64URL input: malformed padding.');
    }
    return new Uint8Array(0);
  }

  if (!BASE64URL_REGEX.test(input)) {
    throw new Error('Invalid Base64URL input: contains characters outside the URL-safe alphabet.');
  }

  if (unpadded.length % 4 === 1) {
    throw new Error('Invalid Base64URL input: truncated or invalid length.');
  }

  const standard = unpadded.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (standard.length % 4)) % 4;
  const padded = standard + '='.repeat(padLength);

  try {
    const binary = getAtob()(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error('Invalid Base64URL input: failed to decode.');
  }
}

/**
 * Encode raw bytes into a padded-free Base64URL string.
 */
export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const btoaFn = getBtoa();
  return btoaFn(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Encode a UTF-8 string to Base64URL.
 */
export function stringToBase64url(input: string): string {
  return bytesToBase64url(new TextEncoder().encode(input));
}

/**
 * Decode a Base64URL string into a UTF-8 string.
 */
export function base64urlToString(input: string): string {
  const bytes = base64urlToBytes(input);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}