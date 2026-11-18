'use strict';

const path = require('path');

function parseArgs(argv) {
  const opts = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && opts[k] !== true) {
        opts[k] = next; i++;
      } else {
        opts[k] = true;
      }
    } else {
      opts._ = opts._ || []; opts._.push(a);
    }
  }
  return opts;
}

function resolveConfig(opts) {
  const env = process.env;
  return {
    port: Number(opts.port || env.ICG_PORT || 3400),
    dataDir: opts['data-dir'] || env.ICG_DATA_DIR || path.join(__dirname, '..', 'data'),
    provider: opts.provider || env.ICG_PROVIDER || 'mock',
    inbox: opts.inbox || env.ICG_INBOX || 'default',
    processedLabel: opts['processed-label'] || env.ICG_PROCESSED_LABEL || 'PROCESSED',
    gmailClientId: opts['gmail-client-id'] || env.GMAIL_CLIENT_ID || '',
    gmailClientSecret: opts['gmail-client-secret'] || env.GMAIL_CLIENT_SECRET || '',
    gmailRedirectUri: opts['gmail-redirect-uri'] || env.GMAIL_REDIRECT_URI || 'http://localhost:3400/oauth/callback',
    outlookClientId: opts['outlook-client-id'] || env.OUTLOOK_CLIENT_ID || '',
    outlookClientSecret: opts['outlook-client-secret'] || env.OUTLOOK_CLIENT_SECRET || '',
    outlookRedirectUri: opts['outlook-redirect-uri'] || env.OUTLOOK_REDIRECT_URI || 'http://localhost:3400/oauth/callback',
    webhookToken: opts['webhook-token'] || env.ICG_WEBHOOK_TOKEN || '',
    mockInboxFile: opts['mock-inbox-file'] || env.ICG_MOCK_INBOX_FILE || '',
  };
}

module.exports = { parseArgs, resolveConfig };