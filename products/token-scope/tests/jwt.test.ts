import { describe, it, expect } from 'vitest';
import { signJwt, splitAndDecodeToken, decodeAndVerify, getExpiryInfo } from '../src/crypto/jwt.js';
import { generateDemoJwt, generateExpiredJwt, getMalformedFixtures, DEMO_SECRET, EXAMPLE_HEADER, EXAMPLE_PAYLOAD } from '../src/fixtures.js';

describe('splitAndDecodeToken', () => {
  it('returns empty for empty/whitespace input', () => {
    expect(splitAndDecodeToken('')).toEqual({ status: 'empty' });
    expect(splitAndDecodeToken('   \n  ')).toEqual({ status: 'empty' });
  });

  it('decodes a valid HS256 JWT and pretty-prints header/payload', async () => {
    const token = await generateDemoJwt();
    const res = splitAndDecodeToken(token);
    expect(res.status).toBe('ok');
    expect(res.decoded?.header.alg).toBe('HS256');
    expect(res.decoded?.payload.sub).toBe('user-42');
    expect(res.decoded?.payload.name).toBe('Demo User');
    expect(res.decoded?.payload.role).toBe('developer');
    expect(res.decoded?.headerJson.pretty).toBe(JSON.stringify(EXAMPLE_HEADER, null, 2));
    expect(res.decoded?.payloadJson.pretty).toBe(JSON.stringify(EXAMPLE_PAYLOAD, null, 2));
  });

  it('tolerates leading/trailing whitespace and newlines', async () => {
    const token = await generateDemoJwt();
    const res = splitAndDecodeToken(`\n  ${token}  \n`);
    expect(res.status).toBe('ok');
    expect(res.decoded?.payload.sub).toBe('user-42');
  });

  it('reports malformed tokens with named issues', () => {
    for (const fixture of getMalformedFixtures()) {
      const res = splitAndDecodeToken(fixture.token);
      expect(res.status).toBe('error');
      expect(res.error).toMatch(fixture.expectedIssue);
    }
  });

  it('reports missing alg in header', async () => {
    // header: {"typ":"JWT"} no alg
    const token = 'eyJ0eXAiOiJKV1QifQ.eyJzdWIiOiIxIn0.sig';
    const res = splitAndDecodeToken(token);
    expect(res.status).toBe('error');
    expect(res.error).toMatch(/missing required "alg"/i);
  });

  it('supports "none" algorithm decode', async () => {
    const token = await signJwt({ alg: 'none', typ: 'JWT' }, EXAMPLE_PAYLOAD, '');
    const res = splitAndDecodeToken(token);
    expect(res.status).toBe('ok');
    expect(res.decoded?.algorithm).toBe('none');
    expect(res.decoded?.isSupportedAlgorithm).toBe(true);
  });
});

describe('getExpiryInfo', () => {
  it('marks past exp as expired with relative hint', () => {
    const now = 1700000000;
    const info = getExpiryInfo({ exp: now - 3600 }, now);
    expect(info.state).toBe('expired');
    expect(info.label).toBe('Expired');
    expect(info.detail).toMatch(/ago/);
  });

  it('marks future exp as active', () => {
    const now = 1700000000;
    const info = getExpiryInfo({ exp: now + 7200 }, now);
    expect(info.state).toBe('active');
    expect(info.detail).toMatch(/Expires in/);
  });

  it('marks future nbf as not-yet-valid', () => {
    const now = 1700000000;
    const info = getExpiryInfo({ nbf: now + 600, exp: now + 7200 }, now);
    expect(info.state).toBe('not-yet-valid');
    expect(info.label).toBe('Not yet valid');
  });

  it('treats missing exp as no-expiry', () => {
    const info = getExpiryInfo({}, 1700000000);
    expect(info.state).toBe('active');
    expect(info.label).toBe('No expiry set');
  });
});

describe('decodeAndVerify (HS256)', () => {
  it('verifies a valid HS256 token with correct secret', async () => {
    const token = await generateDemoJwt();
    const { decode, verify } = await decodeAndVerify(token, DEMO_SECRET);
    expect(decode.status).toBe('ok');
    expect(verify?.state).toBe('valid');
    expect(verify?.message).toMatch(/Valid HS256 signature/);
  });

  it('reports invalid signature with wrong secret', async () => {
    const token = await generateDemoJwt();
    const { verify } = await decodeAndVerify(token, 'wrong-secret');
    expect(verify?.state).toBe('invalid');
    expect(verify?.message).toMatch(/Invalid HS256 signature/);
  });

  it('reports unsigned for "none" algorithm', async () => {
    const token = await signJwt({ alg: 'none', typ: 'JWT' }, EXAMPLE_PAYLOAD, '');
    const { verify } = await decodeAndVerify(token, '');
    expect(verify?.state).toBe('unsigned');
  });

  it('shows expired status for an expired token', async () => {
    const token = await generateExpiredJwt();
    const { decode } = await decodeAndVerify(token, DEMO_SECRET);
    expect(decode.status).toBe('ok');
    expect(decode.decoded?.expiry.state).toBe('expired');
    expect(decode.decoded?.expiry.label).toBe('Expired');
  });

  it('generate→re-decode preserves claims (B1)', async () => {
    const payload = { sub: 'u-1', role: 'admin', custom: 'edited', iat: 1700000000, exp: 9999999999 };
    const token = await signJwt({ alg: 'HS256', typ: 'JWT' }, payload, 'secret123');
    const res = splitAndDecodeToken(token);
    expect(res.status).toBe('ok');
    expect(res.decoded?.payload.sub).toBe('u-1');
    expect(res.decoded?.payload.role).toBe('admin');
    expect(res.decoded?.payload.custom).toBe('edited');
  });

  it('algorithm switched to none creates unsigned token (B2)', async () => {
    const token = await signJwt({ alg: 'none', typ: 'JWT' }, EXAMPLE_PAYLOAD, '');
    expect(token.endsWith('.')).toBe(true);
    const res = splitAndDecodeToken(token);
    expect(res.status).toBe('ok');
    expect(res.decoded?.algorithm).toBe('none');
  });
});