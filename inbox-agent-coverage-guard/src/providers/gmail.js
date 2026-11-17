'use strict';

// Gmail API adapter using stored OAuth tokens.
// Fetches inbox messages with in:inbox query, dedupes by message ID,
// and applies processed-label subtraction done in reconcile.js.
class GmailProvider {
  constructor(tokens, account) {
    this.tokens = tokens || {};
    this.account = account || null;
  }

  async _accessToken() {
    const t = this.tokens;
    if (t.access_token && (!t.expires_at || Date.now() < t.expires_at)) return t.access_token;
    if (!t.refresh_token || !this.tokens.client_id || !this.tokens.client_secret) {
      throw new Error('Gmail provider: no access token and no refresh token/client configured');
    }
    const body = new URLSearchParams({
      client_id: this.tokens.client_id,
      client_secret: this.tokens.client_secret,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    });
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gmail token refresh failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    this.tokens = { ...t, access_token: data.access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
    return this.tokens.access_token;
  }

  async listInbox() {
    const token = await this._accessToken();
    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500&q=' + encodeURIComponent('in:inbox');
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gmail list failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    const out = [];
    for (const stub of (data.messages || [])) {
      const m = await this.getMessage(token, stub.id);
      if (m) out.push(m);
    }
    // Deduplicate by message id
    const seen = new Set();
    return out.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }

  async getMessage(token, id) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const headers = {};
    for (const h of (data.payload && data.payload.headers) || []) headers[h.name.toLowerCase()] = h.value;
    return {
      id: String(data.id),
      thread_id: data.threadId || null,
      from: headers.from || null,
      to: headers.to || null,
      subject: headers.subject || '',
      snippet: data.snippet || '',
      received_at: headers.date || null,
      label_ids: data.labelIds || [],
    };
  }
}

module.exports = { GmailProvider };