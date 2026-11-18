// @ts-check
/**
 * GitHub App install + OAuth scaffolding.
 * In production, configure GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET.
 * This module provides helpers for OAuth URL generation, webhook signature verification, and installation token exchange.
 */
import crypto from 'node:crypto';

export function getOAuthUrl({ clientId, redirectUri, state }) {
  const id = clientId || process.env.GITHUB_CLIENT_ID || '';
  const params = new URLSearchParams({ client_id: id, state: state || 'state' });
  if (redirectUri) params.set('redirect_uri', redirectUri);
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export function verifyWebhookSignature(payload, signature, secret) {
  const sec = secret || process.env.GITHUB_WEBHOOK_SECRET || '';
  if (!sec) return false;
  const hmac = crypto.createHmac('sha256', sec).update(payload).digest('hex');
  const expected = `sha256=${hmac}`;
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || '')); }
  catch { return false; }
}

export async function exchangeInstallationToken({ installationId, appId, privateKeyPem }) {
  // Placeholder for production JWT + installation token exchange.
  // Requires @octokit/auth-app or manual JWT signing; kept as scaffold for M1.
  return {
    token: process.env.GITHUB_TOKEN || null,
    expires_at: null,
    installation_id: installationId,
    note: 'scaffold: configure GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY for live installation tokens',
  };
}

export function isConfigured() {
  return Boolean(process.env.GITHUB_APP_ID || process.env.GITHUB_CLIENT_ID || process.env.GITHUB_TOKEN);
}