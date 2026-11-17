'use strict';

const { addDeadLetter, listDeadLetter, getDeadLetter, logEvent } = require('./storage');

function enqueueFailure(db, entry) {
  const id = addDeadLetter(db, {
    message_id: entry.message_id,
    inbox_id: entry.inbox_id,
    agent_id: entry.agent_id,
    action: entry.action,
    payload: entry.payload,
    error: entry.error,
    status: 'pending',
    attempts: 0,
  });
  logEvent(db, 'dlq_enqueue', 'dead_letter', String(id), { message_id: entry.message_id, agent_id: entry.agent_id, error: entry.error });
  return id;
}

async function retryEntry(db, entryId, dispatcher) {
  const entry = getDeadLetter(db, entryId);
  if (!entry) return { ok: false, error: 'not found' };
  if (entry.status === 'resolved') return { ok: false, error: 'already resolved' };
  const newAttempts = entry.attempts + 1;
  db.prepare('UPDATE dead_letter SET attempts = ?, status = ?, resolved_at = ? WHERE id = ?')
    .run(newAttempts, newAttempts > 3 ? 'dead' : 'retrying', null, entryId);
  logEvent(db, 'dlq_retry', 'dead_letter', String(entryId), { attempt: newAttempts });

  try {
    await dispatcher(entry);
    db.prepare('UPDATE dead_letter SET status = ?, resolved_at = ? WHERE id = ?')
      .run('resolved', new Date().toISOString(), entryId);
    logEvent(db, 'dlq_resolved', 'dead_letter', String(entryId), { message_id: entry.message_id });
    return { ok: true, resolved: true };
  } catch (e) {
    const finalStatus = newAttempts >= 3 ? 'dead' : 'retrying';
    db.prepare('UPDATE dead_letter SET status = ? WHERE id = ?').run(finalStatus, entryId);
    logEvent(db, 'dlq_failed', 'dead_letter', String(entryId), { error: e.message, status: finalStatus });
    return { ok: false, error: e.message };
  }
}

function resolveEntry(db, entryId) {
  const entry = getDeadLetter(db, entryId);
  if (!entry) return { ok: false, error: 'not found' };
  db.prepare('UPDATE dead_letter SET status = ?, resolved_at = ? WHERE id = ?')
    .run('resolved', new Date().toISOString(), entryId);
  logEvent(db, 'dlq_manual_resolve', 'dead_letter', String(entryId), { message_id: entry.message_id });
  return { ok: true };
}

module.exports = { enqueueFailure, retryEntry, resolveEntry, listDeadLetter: require('./storage').listDeadLetter, getDeadLetter };