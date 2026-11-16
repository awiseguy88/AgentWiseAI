import { signJwt, splitAndDecodeToken } from './crypto/jwt.js';
import { JwtHeader, JwtPayload } from './types.js';

export const DEMO_SECRET = 'demo-secret-2026';

export const EXAMPLE_HEADER: JwtHeader = {
  alg: 'HS256',
  typ: 'JWT',
};

export const EXAMPLE_PAYLOAD: JwtPayload = {
  sub: 'user-42',
  name: 'Demo User',
  role: 'developer',
  iat: 1700000000,
  exp: 9999999999,
};

export const EXPIRED_PAYLOAD: JwtPayload = {
  sub: 'user-42',
  name: 'Demo User',
  role: 'developer',
  iat: 1600000000,
  exp: 1600000100,
};

export async function generateDemoJwt(
  payload: JwtPayload = EXAMPLE_PAYLOAD,
  header: JwtHeader = EXAMPLE_HEADER,
  secret: string = DEMO_SECRET,
): Promise<string> {
  return signJwt(header, payload, secret);
}

export async function generateExpiredJwt(): Promise<string> {
  return signJwt(EXAMPLE_HEADER, EXPIRED_PAYLOAD, DEMO_SECRET);
}

export async function generateUnsignedJwt(): Promise<string> {
  return signJwt({ alg: 'none', typ: 'JWT' }, EXAMPLE_PAYLOAD, '');
}

export function getMalformedFixtures(): Array<{ name: string; token: string; expectedIssue: RegExp }> {
  return [
    {
      name: 'non-jwt string',
      token: 'not-a-jwt',
      expectedIssue: /3 dot-separated segments/i,
    },
    {
      name: 'two segments',
      token: 'a.b',
      expectedIssue: /3 dot-separated segments/i,
    },
    {
      name: 'invalid base64url',
      token: '!!!@@@###.e30.sig',
      expectedIssue: /Invalid header segment|Base64URL/i,
    },
    {
      name: 'non-JSON payload',
      // header: {"alg":"HS256","typ":"JWT"}, payload: "hello" (base64url: aGVsbG8)
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aGVsbG8.sig',
      expectedIssue: /Invalid payload JSON/i,
    },
  ];
}

export function checkDemoDecoded(token: string): ReturnType<typeof splitAndDecodeToken> {
  return splitAndDecodeToken(token);
}