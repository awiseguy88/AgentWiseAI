import { base64urlToBytes, bytesToBase64url, stringToBase64url } from './base64url.js';
import {
  DecodedJwt,
  DecodeResult,
  ExpiryInfo,
  ExpiryState,
  JwtAlgorithm,
  JwtHeader,
  JwtPayload,
  SUPPORTED_ALGORITHMS,
  VerifyResult,
} from '../types.js';

function getSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function pemToDer(pem: string, label: 'PUBLIC KEY' | 'PRIVATE KEY' | 'RSA PUBLIC KEY'): Uint8Array {
  const match = pem.match(
    new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`),
  );
  if (!match || !match[1]) {
    throw new Error(`Invalid PEM format: missing ${label} markers.`);
  }
  return base64urlToBytes(match[1].trim().replace(/\+/g, '-').replace(/\//g, '_'));
}

function getHashName(alg: string): string {
  switch (alg) {
    case 'HS256':
    case 'RS256':
    case 'PS256':
    case 'ES256':
      return 'SHA-256';
    case 'HS384':
    case 'RS384':
    case 'PS384':
    case 'ES384':
      return 'SHA-384';
    case 'HS512':
    case 'RS512':
    case 'PS512':
    case 'ES512':
      return 'SHA-512';
    default:
      return 'SHA-256';
  }
}

export function formatRelativeDuration(totalSeconds: number): string {
  const sec = Math.max(1, Math.floor(Math.abs(totalSeconds)));
  if (sec < 60) {
    return `${sec} second${sec === 1 ? '' : 's'}`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min} minute${min === 1 ? '' : 's'}`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr} hour${hr === 1 ? '' : 's'}`;
  }
  const days = Math.floor(hr / 24);
  if (days < 365) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const years = Math.floor(days / 365);
  const remDays = days % 365;
  if (remDays === 0) {
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  return `${years} year${years === 1 ? '' : 's'}, ${remDays} day${remDays === 1 ? '' : 's'}`;
}

export function getExpiryInfo(payload: JwtPayload, nowSeconds: number = Math.floor(Date.now() / 1000)): ExpiryInfo {
  const exp = typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : undefined;
  const nbf = typeof payload.nbf === 'number' && Number.isFinite(payload.nbf) ? payload.nbf : undefined;
  const iat = typeof payload.iat === 'number' && Number.isFinite(payload.iat) ? payload.iat : undefined;

  let state: ExpiryState = 'active';
  let label = 'No expiry set';
  let detail = 'This token has no "exp" claim and does not expire.';

  if (exp !== undefined) {
    if (exp < nowSeconds) {
      state = 'expired';
      label = 'Expired';
      detail = `Expired ${formatRelativeDuration(nowSeconds - exp)} ago.`;
    } else {
      state = 'active';
      label = 'Active';
      detail = `Expires in ${formatRelativeDuration(exp - nowSeconds)}.`;
    }
  }

  if (nbf !== undefined && nbf > nowSeconds) {
    state = 'not-yet-valid';
    label = 'Not yet valid';
    detail = `Token is not valid yet (nbf in ${formatRelativeDuration(nbf - nowSeconds)}).`;
  }

  return { state, label, detail, exp, nbf, iat };
}

export function splitAndDecodeToken(rawToken: string): DecodeResult {
  const trimmed = rawToken.trim();
  if (trimmed.length === 0) {
    return { status: 'empty' };
  }

  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return {
      status: 'error',
      error: `Malformed token: expected 3 dot-separated segments (header.payload.signature), found ${parts.length}.`,
    };
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  if (headerPart.length === 0) {
    return { status: 'error', error: 'Malformed token: header segment is empty.' };
  }
  if (payloadPart.length === 0) {
    return { status: 'error', error: 'Malformed token: payload segment is empty.' };
  }

  let headerText: string;
  try {
    headerText = new TextDecoder('utf-8', { fatal: true }).decode(base64urlToBytes(headerPart));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return { status: 'error', error: `Invalid header segment: ${msg}` };
  }

  let headerObj: unknown;
  try {
    headerObj = JSON.parse(headerText);
  } catch {
    return {
      status: 'error',
      error: 'Invalid header JSON: header segment is not valid JSON.',
    };
  }

  if (headerObj === null || typeof headerObj !== 'object' || Array.isArray(headerObj)) {
    return {
      status: 'error',
      error: 'Invalid header: decoded JSON is not an object.',
    };
  }

  const header = headerObj as JwtHeader;
  if (typeof header.alg !== 'string' || header.alg.trim().length === 0) {
    return {
      status: 'error',
      error: 'Invalid header: missing required "alg" (algorithm) field.',
    };
  }

  let payloadText: string;
  try {
    payloadText = new TextDecoder('utf-8', { fatal: true }).decode(base64urlToBytes(payloadPart));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return { status: 'error', error: `Invalid payload segment: ${msg}` };
  }

  let payloadObj: unknown;
  try {
    payloadObj = JSON.parse(payloadText);
  } catch {
    return {
      status: 'error',
      error: 'Invalid payload JSON: payload segment is not valid JSON.',
    };
  }

  if (payloadObj === null || typeof payloadObj !== 'object' || Array.isArray(payloadObj)) {
    return {
      status: 'error',
      error: 'Invalid payload: decoded JSON is not an object.',
    };
  }

  const payload = payloadObj as JwtPayload;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = signaturePart.length > 0 ? base64urlToBytes(signaturePart) : new Uint8Array(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return { status: 'error', error: `Invalid signature segment: ${msg}` };
  }

  const headerPretty = JSON.stringify(header, null, 2);
  const payloadPretty = JSON.stringify(payload, null, 2);

  const algorithm = header.alg;
  const isSupportedAlgorithm = (SUPPORTED_ALGORITHMS as readonly string[]).includes(algorithm);
  const expiry = getExpiryInfo(payload);

  const decoded: DecodedJwt = {
    token: trimmed,
    header,
    payload,
    headerJson: { raw: headerPart, json: header, pretty: headerPretty },
    payloadJson: { raw: payloadPart, json: payload, pretty: payloadPretty },
    signatureRaw: signaturePart,
    signatureBytes,
    algorithm,
    isSupportedAlgorithm,
    expiry,
  };

  return { status: 'ok', decoded };
}

function looksLikePem(secret: string): boolean {
  return secret.includes('-----BEGIN');
}

async function verifySignature(decoded: DecodedJwt, secret: string): Promise<VerifyResult> {
  const { algorithm, isSupportedAlgorithm, token } = decoded;
  const signingInput = token.slice(0, token.lastIndexOf('.'));

  if (!isSupportedAlgorithm) {
    return {
      state: 'unsupported',
      algorithm,
      message: `Unsupported algorithm "${algorithm}". Supported algorithms: none, HS256, RS256, ES256, PS256.`,
    };
  }

  if (algorithm === 'none') {
    if (decoded.signatureRaw.length > 0) {
      return {
        state: 'invalid',
        algorithm,
        message: 'Invalid signature: algorithm "none" must have an empty signature segment.',
      };
    }
    return {
      state: 'unsigned',
      algorithm,
      message: 'Unsigned token (alg: none) — the signature is not cryptographically verified.',
    };
  }

  if (!secret.trim()) {
    return {
      state: 'unchecked',
      algorithm,
      message: `Enter a ${looksLikePem(secret) ? 'key' : 'secret'} to verify the ${algorithm} signature.`,
    };
  }

  try {
    const subtle = getSubtle();
    const data = new TextEncoder().encode(signingInput);
    const sig = decoded.signatureBytes;

    if (sig.length === 0) {
      return {
        state: 'invalid',
        algorithm,
        message: `Invalid signature: ${algorithm} token has no signature bytes.`,
      };
    }

    if (algorithm.startsWith('HS')) {
      const hash = getHashName(algorithm);
      const key = await subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash },
        false,
        ['verify'],
      );
      const valid = await subtle.verify('HMAC', key, toBufferSource(sig), data);
      return {
        state: valid ? 'valid' : 'invalid',
        algorithm,
        message: valid ? `Valid ${algorithm} signature` : `Invalid ${algorithm} signature`,
      };
    }

    if (algorithm === 'RS256' || algorithm === 'PS256') {
      const isPrivate = secret.includes('-----BEGIN PRIVATE KEY-----') || secret.includes('-----BEGIN RSA PRIVATE KEY-----');
      const label = isPrivate ? 'PUBLIC KEY' : secret.includes('-----BEGIN RSA PUBLIC KEY-----') ? 'RSA PUBLIC KEY' : 'PUBLIC KEY';
      const der = pemToDer(secret, label as 'PUBLIC KEY' | 'RSA PUBLIC KEY');
      const importAlg =
        algorithm === 'RS256'
          ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
          : { name: 'RSA-PSS', hash: 'SHA-256' };
      const key = await subtle.importKey('spki', toBufferSource(der), importAlg, false, ['verify']);
      const verifyAlg = algorithm === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'RSA-PSS', saltLength: 32 };
      const valid = await subtle.verify(verifyAlg, key, toBufferSource(sig), data);
      return {
        state: valid ? 'valid' : 'invalid',
        algorithm,
        message: valid ? `Valid ${algorithm} signature` : `Invalid ${algorithm} signature`,
      };
    }

    if (algorithm === 'ES256') {
      const der = pemToDer(secret, 'PUBLIC KEY');
      const key = await subtle.importKey('spki', toBufferSource(der), { name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'verify',
      ]);
      const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, toBufferSource(sig), data);
      return {
        state: valid ? 'valid' : 'invalid',
        algorithm,
        message: valid ? `Valid ${algorithm} signature` : `Invalid ${algorithm} signature`,
      };
    }

    return {
      state: 'unsupported',
      algorithm,
      message: `Unsupported algorithm "${algorithm}".`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'verification failed';
    return {
      state: 'invalid',
      algorithm,
      message: `Signature verification failed: ${msg}`,
    };
  }
}

export async function decodeAndVerify(rawToken: string, secret: string): Promise<{ decode: DecodeResult; verify?: VerifyResult }> {
  const decode = splitAndDecodeToken(rawToken);
  if (decode.status !== 'ok' || !decode.decoded) {
    return { decode };
  }
  const verify = await verifySignature(decode.decoded, secret);
  return { decode, verify };
}

export async function signJwt(
  header: JwtHeader,
  payload: JwtPayload,
  secret: string,
): Promise<string> {
  const alg = header.alg;
  const headerB64 = stringToBase64url(JSON.stringify(header));
  const payloadB64 = stringToBase64url(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  if (alg === 'none') {
    return `${unsignedToken}.`;
  }

  if (!secret) {
    throw new Error(`A secret or private key is required for ${alg}.`);
  }

  const subtle = getSubtle();
  const data = new TextEncoder().encode(unsignedToken);

  if (alg === 'HS256' || alg === 'HS384' || alg === 'HS512') {
    const hash = getHashName(alg);
    const key = await subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash },
      false,
      ['sign'],
    );
    const sigBuf = await subtle.sign('HMAC', key, data);
    return `${unsignedToken}.${bytesToBase64url(new Uint8Array(sigBuf))}`;
  }

  if (alg === 'RS256' || alg === 'PS256') {
    if (!secret.includes('-----BEGIN PRIVATE KEY-----') && !secret.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      throw new Error(`${alg} signing requires a PEM-encoded private key (-----BEGIN PRIVATE KEY-----).`);
    }
    const der = pemToDer(secret, 'PRIVATE KEY');
    const importAlg =
      alg === 'RS256'
        ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
        : { name: 'RSA-PSS', hash: 'SHA-256' };
    const key = await subtle.importKey('pkcs8', toBufferSource(der), importAlg, false, ['sign']);
    const signAlg = alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'RSA-PSS', saltLength: 32 };
    const sigBuf = await subtle.sign(signAlg, key, data);
    return `${unsignedToken}.${bytesToBase64url(new Uint8Array(sigBuf))}`;
  }

  if (alg === 'ES256') {
    if (!secret.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('ES256 signing requires a PEM-encoded private key (-----BEGIN PRIVATE KEY-----).');
    }
    const der = pemToDer(secret, 'PRIVATE KEY');
    const key = await subtle.importKey('pkcs8', toBufferSource(der), { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'sign',
    ]);
    const sigBuf = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);
    return `${unsignedToken}.${bytesToBase64url(new Uint8Array(sigBuf))}`;
  }

  throw new Error(`Unsupported signing algorithm: ${alg}`);
}

export async function verifyJwt(token: string, secret: string): Promise<VerifyResult> {
  const { verify } = await decodeAndVerify(token, secret);
  if (!verify) {
    return {
      state: 'unsupported',
      algorithm: 'unknown',
      message: 'Unable to verify token.',
    };
  }
  return verify;
}