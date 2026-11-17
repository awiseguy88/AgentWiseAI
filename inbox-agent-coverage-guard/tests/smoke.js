'use strict';

// Offline smoke test for Inbox Agent Coverage Guard.
// Covers all 3 acceptance criteria from issue #119.

const fs = require('fs');
const path = require('path');
const { openStore, ensureInbox, getInbox, listMessages, listDeadLetter, listSweeps, getLatestSweep, logEvent, markProcessed } = require('../src/storage');
const { createProvider } = require('../src/providers');
const { runSweep } = require('../src/reconcile');
const { enqueueFailure, retryEntry, resolveEntry } = require('../src/deadletter');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const DATA_DIR = path.resolve(FIXTURES_DIR, '..', '..', 'data', 'smoke-test');
const INBOX_ID = 'smoke-test-inbox';

function cleanDataDir() {
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log('  ✓', msg);
}

async function runSmoke() {
  console.log('\n=== Inbox Coverage Guard Smoke Test ===\n');

  cleanDataDir();
  const db = openStore(DATA_DIR);

  // Ensure inbox exists
  ensureInbox(db, INBOX_ID, 'mock', 'mock-account', { mock_file: path.join(FIXTURES_DIR, 'gmail-inbox.json') });

  // ===== Acceptance 1: Reconciliation sweep finds 5 untouched emails =====
  console.log('--- Acceptance 1: Reconciliation sweep ---');
  const inbox = getInbox(db, INBOX_ID);
  const provider = createProvider('mock:' + path.join(FIXTURES_DIR, 'gmail-inbox.json'), inbox);

  // Pre-load agent-reported processed IDs (from webhook) — 15 of 20
  const agentProcessed = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'agent-processed.json'), 'utf8'));
  for (const p of agentProcessed.processed) {
    markProcessed(db, INBOX_ID, p.message_id, 'booking-agent', p.action, new Date().toISOString(), p.payload);
  }

  const sweepResult = await runSweep(db, inbox, provider, 'PROCESSED');
  console.log(`  Sweep result: total=${sweepResult.stats.total}, touched=${sweepResult.stats.touched}, untouched=${sweepResult.stats.untouched}, failed=${sweepResult.stats.failed}`);

  assert(sweepResult.stats.total === 20, 'total emails = 20');
  assert(sweepResult.stats.touched === 15, 'touched = 15 (from label + webhook)');
  assert(sweepResult.stats.untouched === 5, 'untouched = 5');
  assert(sweepResult.stats.failed === 0, 'failed = 0');

  // Review queue shows 5 untouched with message-IDs and timestamps
  const reviewQueue = sweepResult.untouched;
  assert(reviewQueue.length === 5, 'review queue has 5 entries');
  for (const m of reviewQueue) {
    assert(m.id && m.received_at, `review entry ${m.id} has id and timestamp`);
  }
  console.log('  Review queue message-IDs:', reviewQueue.map(m => m.id).join(', '));

  // Verify storage has messages
  const storedMsgs = listMessages(db, INBOX_ID);
  assert(storedMsgs.length === 20, 'stored 20 messages');
  const touchedCount = storedMsgs.filter(m => m.touched).length;
  const untouchedCount = storedMsgs.filter(m => !m.touched).length;
  assert(touchedCount === 15, '15 stored messages touched');
  assert(untouchedCount === 5, '5 stored messages untouched');

  // ===== Acceptance 2: Dead-letter queue captures failure, retry works, audit log shows resolution =====
  console.log('\n--- Acceptance 2: Dead-letter queue ---');
  const failedFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'failed-actions.json'), 'utf8'));
  const failure = failedFixture.failed[0];

  // Enqueue failure
  const dlqId = enqueueFailure(db, {
    message_id: failure.message_id,
    inbox_id: INBOX_ID,
    agent_id: failedFixture.agent,
    action: failure.action,
    payload: failure.payload,
    error: failure.error,
  });
  console.log(`  Enqueued DLQ entry #${dlqId}`);
  assert(dlqId, 'DLQ entry created');

  // Check DLQ has the entry
  let dlqEntries = listDeadLetter(db);
  assert(dlqEntries.length === 1, 'DLQ has 1 entry');
  assert(dlqEntries[0].status === 'pending', 'DLQ entry status = pending');
  assert(dlqEntries[0].message_id === 'm16', 'DLQ message_id = m16');
  assert(dlqEntries[0].error && dlqEntries[0].error.status === 503, 'DLQ error captured with 503');

  // Retry with dispatcher that succeeds on second attempt
  let retryAttempt = 0;
  const dispatcher = async (entry) => {
    retryAttempt++;
    if (retryAttempt === 1) {
      // First retry fails (simulating transient error)
      throw new Error('Service Unavailable (503)');
    }
    // Second retry succeeds
    return true;
  };

  // First retry (will fail)
  let retryResult = await retryEntry(db, dlqId, dispatcher);
  assert(!retryResult.ok, 'first retry fails');
  assert(retryResult.error.includes('503'), 'first retry error mentions 503');
  console.log(`  First retry: ${retryResult.error}`);

  // Check status is retrying
  dlqEntries = listDeadLetter(db);
  assert(dlqEntries[0].status === 'retrying', 'DLQ status = retrying after failed retry');
  assert(dlqEntries[0].attempts === 1, 'attempts = 1');

  // Second retry (will succeed)
  retryResult = await retryEntry(db, dlqId, dispatcher);
  assert(retryResult.ok, 'second retry succeeds');
  assert(retryResult.resolved === true, 'second retry resolved');
  console.log('  Second retry: resolved');

  // Check status is resolved
  dlqEntries = listDeadLetter(db);
  assert(dlqEntries[0].status === 'resolved', 'DLQ status = resolved');
  assert(dlqEntries[0].resolved_at, 'resolved_at timestamp set');

  // Audit log shows dlq_enqueue, dlq_retry, dlq_failed, dlq_resolved
  const audit = require('../src/storage').listAuditLog(db, 100);
  const dlqEvents = audit.filter(a => a.event.startsWith('dlq_'));
  console.log('  DLQ audit events:', dlqEvents.map(e => e.event).join(', '));
  assert(dlqEvents.some(e => e.event === 'dlq_enqueue'), 'audit has dlq_enqueue');
  assert(dlqEvents.some(e => e.event === 'dlq_retry'), 'audit has dlq_retry');
  assert(dlqEvents.some(e => e.event === 'dlq_failed'), 'audit has dlq_failed');
  assert(dlqEvents.some(e => e.event === 'dlq_resolved'), 'audit has dlq_resolved');

  // ===== Acceptance 3: Coverage dashboard shows "15 processed, 5 untouched, 0 failed" =====
  console.log('\n--- Acceptance 3: Coverage dashboard ---');
  const latestSweep = getLatestSweep(db, INBOX_ID);
  assert(latestSweep, 'latest sweep recorded');
  assert(latestSweep.total === 20, 'sweep total = 20');
  assert(latestSweep.touched === 15, 'sweep touched = 15');
  assert(latestSweep.untouched === 5, 'sweep untouched = 5');
  assert(latestSweep.failed === 0, 'sweep failed = 0');
  console.log(`  Dashboard: ${latestSweep.touched} processed, ${latestSweep.untouched} untouched, ${latestSweep.failed} failed`);

  // Per-email detail available
  const allMsgs = listMessages(db, INBOX_ID);
  assert(allMsgs.length === 20, 'all 20 messages available with detail');
  const withDetail = allMsgs.every(m => m.id && m.subject && m.received_at);
  assert(withDetail, 'all messages have id, subject, timestamp');

  // Refresh sweep (run again) - should be idempotent
  console.log('  Re-running sweep to verify refresh...');
  const sweep2 = await runSweep(db, inbox, provider, 'PROCESSED');
  assert(sweep2.stats.total === 20, 'second sweep total = 20');
  assert(sweep2.stats.touched === 15, 'second sweep touched = 15');
  assert(sweep2.stats.untouched === 5, 'second sweep untouched = 5');
  console.log('  Second sweep matches first (offline, idempotent)');

  // All sweeps recorded
  const sweeps = listSweeps(db, INBOX_ID);
  assert(sweeps.length >= 2, 'multiple sweeps stored');
  console.log(`  ${sweeps.length} sweeps in history`);

  // ===== Bonus: Webhook ingestion test =====
  console.log('\n--- Bonus: Webhook ingestion ---');
  // Simulate agent webhook reporting processed + failed
  const webhookBody = {
    inbox: INBOX_ID,
    processed: [
      { message_id: 'm16', action: 'labeled', payload: { label: 'REVIEWED' } }
    ],
    failed: [
      { message_id: 'm17', action: 'reply', payload: { text: 'test' }, error: { status: 500, message: 'Internal Error' } }
    ]
  };
  // Use storage directly to simulate webhook
  for (const p of webhookBody.processed) {
    markProcessed(db, webhookBody.inbox, p.message_id, 'booking-agent', p.action, new Date().toISOString(), p.payload);
  }
  for (const f of webhookBody.failed) {
    enqueueFailure(db, {
      message_id: f.message_id, inbox_id: webhookBody.inbox, agent_id: 'booking-agent',
      action: f.action, payload: f.payload, error: f.error,
    });
  }

  const newReview = listMessages(db, INBOX_ID).filter(m => !m.touched);
  assert(newReview.length === 4, 'after webhook, 4 untouched (m16 now processed)');

  const newDlq = listDeadLetter(db);
  assert(newDlq.length === 2, 'DLQ now has 2 entries (m16 resolved, m17 new)');
  assert(newDlq.some(d => d.message_id === 'm17' && d.status === 'pending'), 'new failure m17 in DLQ');

  console.log('\n=== ALL SMOKE TESTS PASSED ===\n');
  process.exit(0);
}

runSmoke().catch(err => {
  console.error('\n=== SMOKE TEST FAILED ===');
  console.error(err && err.stack || err);
  process.exit(1);
});