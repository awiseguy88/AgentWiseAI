'use strict';

const fs = require('fs');
const path = require('path');

let Database = null;
function getDB() {
  if (!Database) {
    Database = require('better-sqlite3');
  }
  return Database;
}

function openStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'icg.sqlite');
  const db = new (getDB())(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS inboxes (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      account TEXT,
      tokens TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      inbox_id TEXT NOT NULL,
      thread_id TEXT,
      from_addr TEXT,
      to_addr TEXT,
      subject TEXT,
      snippet TEXT,
      received_at TEXT,
      label_ids TEXT,
      touched INTEGER NOT NULL DEFAULT 0,
      touched_at TEXT,
      touched_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed (
      message_id TEXT PRIMARY KEY,
      inbox_id TEXT NOT NULL,
      agent_id TEXT,
      action TEXT,
      at TEXT NOT NULL,
      payload TEXT
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT,
      webhook_url TEXT,
      secret TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dead_letter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT,
      inbox_id TEXT,
      agent_id TEXT,
      action TEXT,
      payload TEXT,
      error TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      detail TEXT,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sweeps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inbox_id TEXT NOT NULL,
      provider TEXT,
      at TEXT NOT NULL,
      total INTEGER DEFAULT 0,
      touched INTEGER DEFAULT 0,
      untouched INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      stats TEXT
    );
  `);
  return db;
}

function logEvent(db, event, entityType, entityId, detail) {
  const stmt = db.prepare('INSERT INTO audit_log (event, entity_type, entity_id, detail, at) VALUES (?, ?, ?, ?, ?)');
  stmt.run(event, entityType || null, entityId || null, detail ? JSON.stringify(detail) : null, new Date().toISOString());
}

function ensureInbox(db, id, provider, account, tokens) {
  db.prepare('INSERT OR IGNORE INTO inboxes (id, provider, account, tokens, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, provider, account || null, tokens ? JSON.stringify(tokens) : null, new Date().toISOString());
  return getInbox(db, id);
}

function getInbox(db, id) {
  const row = db.prepare('SELECT * FROM inboxes WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    account: row.account,
    tokens: row.tokens ? JSON.parse(row.tokens) : null,
    created_at: row.created_at,
  };
}

function listInboxes(db) {
  return db.prepare('SELECT * FROM inboxes ORDER BY created_at DESC').all().map(r => ({
    id: r.id,
    provider: r.provider,
    account: r.account,
    created_at: r.created_at,
  }));
}

function upsertMessage(db, inboxId, msg) {
  const stmt = db.prepare(`
    INSERT INTO messages (id, inbox_id, thread_id, from_addr, to_addr, subject, snippet, received_at, label_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      subject = excluded.subject,
      snippet = excluded.snippet,
      received_at = excluded.received_at,
      label_ids = excluded.label_ids
  `);
  stmt.run(
    msg.id, inboxId, msg.thread_id || null, msg.from || null, msg.to || null,
    msg.subject || null, msg.snippet || null, msg.received_at || null,
    JSON.stringify(msg.label_ids || []), new Date().toISOString()
  );
}

function markProcessed(db, inboxId, messageId, agentId, action, at, payload) {
  const stmt = db.prepare('INSERT OR REPLACE INTO processed (message_id, inbox_id, agent_id, action, at, payload) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(messageId, inboxId, agentId || null, action || 'processed', at || new Date().toISOString(), payload ? JSON.stringify(payload) : null);
  db.prepare('UPDATE messages SET touched = 1, touched_at = ?, touched_by = ? WHERE id = ?')
    .run(at || new Date().toISOString(), agentId || null, messageId);
}

function addDeadLetter(db, entry) {
  const stmt = db.prepare(`
    INSERT INTO dead_letter (message_id, inbox_id, agent_id, action, payload, error, status, attempts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    entry.message_id || null, entry.inbox_id || null, entry.agent_id || null,
    entry.action || null, entry.payload ? JSON.stringify(entry.payload) : null,
    entry.error ? JSON.stringify(entry.error) : null, entry.status || 'pending',
    entry.attempts || 0, new Date().toISOString()
  );
  return info.lastInsertRowid;
}

function listDeadLetter(db) {
  return db.prepare('SELECT * FROM dead_letter ORDER BY id ASC').all().map(r => ({
    id: r.id,
    message_id: r.message_id,
    inbox_id: r.inbox_id,
    agent_id: r.agent_id,
    action: r.action,
    payload: r.payload ? JSON.parse(r.payload) : null,
    error: r.error ? JSON.parse(r.error) : null,
    status: r.status,
    attempts: r.attempts,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
  }));
}

function getDeadLetter(db, id) {
  const row = db.prepare('SELECT * FROM dead_letter WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id, message_id: row.message_id, inbox_id: row.inbox_id, agent_id: row.agent_id,
    action: row.action, payload: row.payload ? JSON.parse(row.payload) : null,
    error: row.error ? JSON.parse(row.error) : null, status: row.status,
    attempts: row.attempts, created_at: row.created_at, resolved_at: row.resolved_at,
  };
}

function listMessages(db, inboxId) {
  return db.prepare('SELECT * FROM messages WHERE inbox_id = ? ORDER BY received_at ASC').all(inboxId).map(r => ({
    id: r.id, inbox_id: r.inbox_id, thread_id: r.thread_id, from: r.from_addr, to: r.to_addr,
    subject: r.subject, snippet: r.snippet, received_at: r.received_at,
    label_ids: JSON.parse(r.label_ids || '[]'), touched: !!r.touched, touched_at: r.touched_at, touched_by: r.touched_by,
  }));
}

function listSweeps(db, inboxId) {
  return db.prepare('SELECT * FROM sweeps WHERE inbox_id = ? ORDER BY at DESC').all(inboxId).map(r => ({
    id: r.id, inbox_id: r.inbox_id, provider: r.provider, at: r.at,
    total: r.total, touched: r.touched, untouched: r.untouched, failed: r.failed,
    stats: r.stats ? JSON.parse(r.stats) : null,
  }));
}

function getLatestSweep(db, inboxId) {
  const row = db.prepare('SELECT * FROM sweeps WHERE inbox_id = ? ORDER BY at DESC LIMIT 1').get(inboxId);
  if (!row) return null;
  return { id: row.id, inbox_id: row.inbox_id, provider: row.provider, at: row.at, total: row.total, touched: row.touched, untouched: row.untouched, failed: row.failed, stats: row.stats ? JSON.parse(row.stats) : null };
}

function listAuditLog(db, limit) {
  const lim = Number(limit) || 100;
  return db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(lim).map(r => ({
    id: r.id, event: r.event, entity_type: r.entity_type, entity_id: r.entity_id,
    detail: r.detail ? JSON.parse(r.detail) : null, at: r.at,
  }));
}

function recordSweep(db, inboxId, provider, stats) {
  const stmt = db.prepare(`
    INSERT INTO sweeps (inbox_id, provider, at, total, touched, untouched, failed, stats)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(inboxId, provider, new Date().toISOString(), stats.total, stats.touched, stats.untouched, stats.failed, JSON.stringify(stats));
  return info.lastInsertRowid;
}

module.exports = {
  openStore, logEvent, ensureInbox, getInbox, listInboxes,
  upsertMessage, markProcessed, addDeadLetter, listDeadLetter, getDeadLetter,
  listMessages, listSweeps, getLatestSweep, listAuditLog, recordSweep,
};