#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseArgs, resolveConfig } = require('./config');
const { openStore, ensureInbox, getInbox, listMessages, listDeadLetter, listAuditLog, markProcessed } = require('./storage');
const { createProvider } = require('./providers');
const { runSweep } = require('./reconcile');
const { enqueueFailure, retryEntry, resolveEntry } = require('./deadletter');
const { buildServer } = require('./server');

const APP_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_DIR = path.resolve(APP_ROOT, 'data');

function usage() {
  console.log(`Usage: inbox-coverage-guard <command> [options]

Commands:
  serve            Start web dashboard + JSON API
  sweep            Run a reconciliation sweep now
  review           List review queue (untouched emails)
  retry            Retry dead-letter entries
  agents           List registered agents
  connect          Print OAuth connect URL for Gmail/Outlook
  smoke            Run offline smoke tests
  help             Show help

Global options:
  --data-dir <dir>   Persistent data dir (default ./data)
  --provider <spec>  mock:<file> | gmail | outlook (default mock)
  --inbox <id>       Inbox id (default default)
  --port <n>         Dashboard port (default 3400 or ICG_PORT)
  --processed-label <label>  Processed label (default PROCESSED)
  --webhook-token <t>  Webhook token
  --mock-inbox-file <f>  Mock inbox fixture file
`);
}

async function main() {
  const opts = parseArgs(process.argv);
  const config = resolveConfig(opts);
  const cmd = opts._[0];
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') { usage(); process.exit(0); }

  if (cmd === 'smoke') {
    require(path.resolve(APP_ROOT, 'tests/smoke.js'));
    return;
  }

  const db = openStore(config.dataDir);

  if (cmd === 'connect') {
    const provider = opts.provider || 'gmail';
    if (provider === 'gmail') {
      const clientId = config.gmailClientId;
      const redirect = config.gmailRedirectUri;
      const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly');
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
      console.log('Open this URL to connect Gmail:\n' + url);
      console.log('\nCallback: ' + redirect + ' (handled by `serve`)');
      return;
    }
    if (provider === 'outlook') {
      const clientId = config.outlookClientId;
      const redirect = config.outlookRedirectUri;
      const scope = encodeURIComponent('offline_access Mail.Read');
      const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${scope}`;
      console.log('Open this URL to connect Outlook:\n' + url);
      console.log('\nCallback: ' + redirect + ' (handled by `serve`)');
      return;
    }
    console.error('Unknown provider for connect:', provider);
    process.exit(2);
  }

  if (cmd === 'serve') {
    // Add OAuth callback route by wrapping server? We'll just start server; callback handling can be added later.
    buildServer(config);
    return;
  }

  if (cmd === 'sweep') {
    const inboxId = config.inbox;
    const providerSpec = config.provider;
    let inbox = getInbox(db, inboxId);
    if (!inbox) inbox = ensureInbox(db, inboxId, providerSpec.split(':')[0]);
    const provider = createProvider(providerSpec, inbox);
    const result = await runSweep(db, inbox, provider, config.processedLabel);
    console.log(`Sweep complete: ${result.stats.touched} processed, ${result.stats.untouched} untouched, ${result.stats.failed} failed (of ${result.stats.total})`);
    process.exit(0);
  }

  if (cmd === 'review') {
    const inboxId = config.inbox;
    const msgs = listMessages(db, inboxId).filter(m => !m.touched);
    console.log(`Review queue (${msgs.length}):`);
    for (const m of msgs) console.log(`  ${m.id}  ${m.received_at}  ${m.subject}`);
    process.exit(0);
  }

  if (cmd === 'retry') {
    const entries = listDeadLetter(db).filter(e => e.status === 'pending' || e.status === 'retrying');
    let resolved = 0;
    for (const e of entries) {
      const dispatcher = async (entry) => {
        if (entry.payload && entry.payload.mock_dispatch && entry.payload.mock_dispatch.fail) throw new Error(entry.payload.mock_dispatch.fail);
        return true;
      };
      const r = await retryEntry(db, e.id, dispatcher);
      if (r.ok) resolved++;
      console.log(`  DLQ #${e.id}: ${r.ok ? 'resolved' : r.error}`);
    }
    console.log(`Resolved ${resolved}/${entries.length}`);
    process.exit(0);
  }

  if (cmd === 'agents') {
    const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
    for (const r of rows) console.log(`${r.id}  ${r.name || ''}  ${r.webhook_url || ''}`);
    process.exit(0);
  }

  console.error(`Unknown command: ${cmd}`);
  usage();
  process.exit(2);
}

main().catch(err => { console.error(err && err.stack || err); process.exit(2); });