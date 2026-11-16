export type JwtAlgorithm = 'none' | 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'PS256' | 'ES256';

export const SUPPORTED_ALGORITHMS: readonly JwtAlgorithm[] = [
  'none',
  'HS256',
  'RS256',
  'ES256',
  'PS256',
] as const;

export interface JwtHeader {
  alg: string;
  typ?: string;
  cty?: string;
  kid?: string;
  jku?: string;
  x5u?: string;
  crit?: string[];
  [key: string]: unknown;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface DecodedSegment {
  raw: string;
  json: unknown;
  pretty: string;
}

export type ExpiryState = 'active' | 'expired' | 'not-yet-valid' | 'no-exp' | 'invalid';

export interface ExpiryInfo {
  state: ExpiryState;
  label: string;
  detail: string;
  exp?: number;
  nbf?: number;
  iat?: number;
}

export type VerifyState = 'valid' | 'invalid' | 'unchecked' | 'unsupported' | 'unsigned';

export interface VerifyResult {
  state: VerifyState;
  message: string;
  algorithm: string;
}

export interface DecodedJwt {
  token: string;
  header: JwtHeader;
  payload: JwtPayload;
  headerJson: DecodedSegment;
  payloadJson: DecodedSegment;
  signatureRaw: string;
  signatureBytes: Uint8Array;
  algorithm: JwtAlgorithm | string;
  isSupportedAlgorithm: boolean;
  expiry: ExpiryInfo;
}

export type DecodeStatus = 'empty' | 'ok' | 'error';

export interface DecodeResult {
  status: DecodeStatus;
  decoded?: DecodedJwt;
  error?: string;
}