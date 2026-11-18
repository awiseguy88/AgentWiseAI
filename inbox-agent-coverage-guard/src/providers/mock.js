'use strict';

const fs = require('fs');

// Fixture-based email provider for offline/dev/testing.
// Loads a JSON file with { messages: [ { id, thread_id, from, to, subject, snippet, received_at, label_ids } ] }
class MockProvider {
  constructor(filePath) {
    this.filePath = filePath;
    this.messages = [];
    this._load();
  }

  _load() {
    if (!this.filePath) { this.messages = []; return; }
    const abs = this.filePath.startsWith('/') ? this.filePath : require('path').resolve(process.cwd(), this.filePath);
    if (!fs.existsSync(abs)) { this.messages = []; return; }
    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    this.messages = (data.messages || []).map(m => ({
      id: String(m.id),
      thread_id: m.thread_id || null,
      from: m.from || null,
      to: m.to || null,
      subject: m.subject || '',
      snippet: m.snippet || '',
      received_at: m.received_at || new Date().toISOString(),
      label_ids: m.label_ids || ['INBOX'],
    }));
  }

  async listInbox() {
    return this.messages.filter(m => (m.label_ids || []).includes('INBOX'));
  }
}

module.exports = { MockProvider };