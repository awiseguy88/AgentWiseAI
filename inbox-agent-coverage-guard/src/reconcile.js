'use strict';

// Reconciliation sweep: fetch inbox messages, subtract processed labels + webhook-reported processed IDs,
// dedupe by message-ID, find untouched emails.
const { upsertMessage, markProcessed, listMessages, recordSweep, logEvent } = require('./storage');

function hasProcessedLabel(msg, processedLabel) {
  if (!processedLabel) return false;
  const labels = msg.label_ids || [];
  return labels.some(l => l.toLowerCase() === processedLabel.toLowerCase());
}

async function runSweep(db, inbox, provider, processedLabel, opts = {}) {
  const messages = await provider.listInbox();
  // Get webhook-reported processed IDs for this inbox
  const processedRows = db.prepare('SELECT message_id FROM processed WHERE inbox_id = ?').all(inbox.id);
  const processedSet = new Set(processedRows.map(r => r.message_id));

  // Upsert all fetched messages into storage
  for (const m of messages) {
    upsertMessage(db, inbox.id, m);
  }

  let touched = 0, untouched = 0, failed = 0;
  const untouchedMsgs = [];

  for (const m of messages) {
    const byLabel = hasProcessedLabel(m, processedLabel);
    const byWebhook = processedSet.has(m.id);
    if (byLabel || byWebhook) {
      touched++;
      markProcessed(db, inbox.id, m.id, 'webhook_or_label', 'processed', new Date().toISOString(), { source: byLabel ? 'label' : 'webhook' });
    } else {
      untouched++;
      untouchedMsgs.push(m);
    }
  }

  const stats = {
    total: messages.length,
    touched,
    untouched,
    failed,
    untouched_detail: untouchedMsgs.map(m => ({
      id: m.id, subject: m.subject, from: m.from, snippet: m.snippet, received_at: m.received_at,
    })),
  };
  recordSweep(db, inbox.id, inbox.provider, stats);
  logEvent(db, 'sweep', 'inbox', inbox.id, { total: messages.length, touched, untouched, failed });

  return { inbox: inbox.id, messages, stats, untouched: untouchedMsgs };
}

module.exports = { runSweep, hasProcessedLabel };