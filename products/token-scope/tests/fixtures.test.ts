import { describe, it, expect } from 'vitest';
import { generateDemoJwt, generateExpiredJwt, getMalformedFixtures, checkDemoDecoded, DEMO_SECRET, EXAMPLE_HEADER, EXAMPLE_PAYLOAD } from '../src/fixtures.js';
import { decodeAndVerify, signJwt } from '../src/crypto/jwt.js';

describe('fixtures', () => {
  it('generates a valid HS256 demo JWT matching expected header/payload/secret', async () => {
    const token = await generateDemoJwt();
    const res = checkDemoDecoded(token);
    expect(res.status).toBe('ok');
    expect(res.decoded?.header).toEqual(EXAMPLE_HEADER);
    expect(res.decoded?.payload).toEqual(EXAMPLE_PAYLOAD);

    const { verify } = await decodeAndVerify(token, DEMO_SECRET);
    expect(verify?.state).toBe('valid');
  });

  it('generates an expired JWT with exp in the past', async () => {
    const token = await generateExpiredJwt();
    const { decode } = await decodeAndVerify(token, DEMO_SECRET);
    expect(decode.status).toBe('ok');
    expect(decode.decoded?.expiry.state).toBe('expired');
  });

  it('malformed fixtures are all detected with descriptive errors', () => {
    const fixtures = getMalformedFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(4);
    for (const f of fixtures) {
      const res = checkDemoDecoded(f.token);
      expect(res.status, `fixture ${f.name} should be error`).toBe('error');
      expect(res.error).toMatch(f.expectedIssue);
    }
  });
});

describe('integration: decode→verify→generate→re-decode', () => {
  it('edits payload claim, generates, and decodes back to same claims', async () => {
    const secret = 'integration-secret';
    const edited = { sub: 'user-42', name: 'Demo User', role: 'lead', iat: 1700000000, exp: 9999999999, extra: 'ok' };
    const token = await signJwt({ alg: 'HS256', typ: 'JWT' }, edited, secret);
    const { decode, verify } = await decodeAndVerify(token, secret);
    expect(decode.status).toBe('ok');
    expect(verify?.state).toBe('valid');
    expect(decode.decoded?.payload.role).toBe('lead');
    expect(decode.decoded?.payload.extra).toBe('ok');
  });

  it('wrong secret after re-decode shows invalid signature', async () => {
    const token = await signJwt({ alg: 'HS256', typ: 'JWT' }, EXAMPLE_PAYLOAD, 'correct');
    const { verify } = await decodeAndVerify(token, 'incorrect');
    expect(verify?.state).toBe('invalid');
  });
});