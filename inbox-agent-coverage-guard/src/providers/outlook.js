'use strict';

// Outlook (Microsoft Graph) adapter using stored OAuth tokens.
class OutlookProvider {
  constructor(tokens, account) {
    this.tokens = tokens || {};
    this.account = account || null;
  }

  async _accessToken() {
    const t = this.tokens;
    if (t.access_token && (!t.expires_at || Date.now() < t.expires_at)) return t.access_token;
    if (!t.refresh_token || !t.client_id || !t.client_secret) {
      throw new Error('Outlook provider: no access token and no refresh token/client configured');
    }
    const body = new URLSearchParams({
      client_id: t.client_id,
      client_secret: t.client_secret,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.Read offline_access',
    });
    const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Outlook token refresh failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    this.tokens = { ...t, access_token: data.access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
    return this.tokens.access_token;
  }

  async listInbox() {
    const token = await this._accessToken();
    const url = 'https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=500&$select=id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,categories';
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Outlook list failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    const out = [];
    for (const m of (data.value || [])) {
      out.push({
        id: String(m.id),
        thread_id: m.conversationId || null,
        from: (m.from && m.from.emailAddress) ? m.from.emailAddress.address : null,
        to: (m.toRecipients && m.toRecipients[0] && m.toRecipients[0].emailAddress) ? m.toRecipients[0].emailAddress.address : null,
        subject: m.subject || '',
        snippet: m.bodyPreview || '',
        received_at: m.receivedDateTime || null,
        label_ids: ['INBOX'].concat(m.categories || []),
      });
    }
    const seen = new Set();
    return out.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }
}

module.exports = { OutlookProvider };