'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_DB = path.resolve(__dirname, '..', '.local', 'sentinel.db');

function getDbPath() {
  return process.env.SENTINEL_DB_PATH || DEFAULT_DB;
}

function openDb(dbPath = getDbPath()) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_path TEXT,
      transcript_format TEXT,
      imported_at TEXT DEFAULT (datetime('now')),
      aggregate_json TEXT NOT NULL,
      gate_json TEXT
    );
    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      turn_index INTEGER NOT NULL,
      role TEXT,
      text TEXT,
      step_signature TEXT,
      metrics_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_turns_run ON turns(run_id);
  `);
}

function saveRun({ name, sourcePath, transcriptFormat, aggregate, gate, turns }) {
  const db = openDb();
  try {
    const stmt = db.prepare(
      'INSERT INTO runs (name, source_path, transcript_format, aggregate_json, gate_json) VALUES (?, ?, ?, ?, ?)'
    );
    const res = stmt.run(
      name,
      sourcePath || null,
      transcriptFormat || null,
      JSON.stringify(aggregate || {}),
      JSON.stringify(gate || null)
    );
    const runId = Number(res.lastInsertRowid);
    const tStmt = db.prepare(
      'INSERT INTO turns (run_id, turn_index, role, text, step_signature, metrics_json) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const t of turns || []) {
      tStmt.run(runId, t.index, t.role || 'assistant', t.text || '', t.step_signature || '', JSON.stringify(t.metrics || {}));
    }
    return { runId };
  } finally {
    db.close();
  }
}

function listRuns() {
  const db = openDb();
  try {
    const rows = db.prepare(
      'SELECT id, name, source_path, transcript_format, imported_at, aggregate_json, gate_json FROM runs ORDER BY id DESC'
    ).all();
    return rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      sourcePath: r.source_path,
      transcriptFormat: r.transcript_format,
      importedAt: r.imported_at,
      aggregate: safeJson(r.aggregate_json),
      gate: safeJson(r.gate_json)
    }));
  } finally {
    db.close();
  }
}

function getRun(runId) {
  const db = openDb();
  try {
    const r = db.prepare(
      'SELECT id, name, source_path, transcript_format, imported_at, aggregate_json, gate_json FROM runs WHERE id = ?'
    ).get(runId);
    if (!r) return null;
    const turns = db.prepare(
      'SELECT turn_index, role, text, step_signature, metrics_json FROM turns WHERE run_id = ? ORDER BY turn_index'
    ).all(runId);
    return {
      id: Number(r.id),
      name: r.name,
      sourcePath: r.source_path,
      transcriptFormat: r.transcript_format,
      importedAt: r.imported_at,
      aggregate: safeJson(r.aggregate_json),
      gate: safeJson(r.gate_json),
      turns: turns.map(t => ({
        index: Number(t.turn_index),
        role: t.role,
        text: t.text,
        step_signature: t.step_signature,
        metrics: safeJson(t.metrics_json)
      }))
    };
  } finally {
    db.close();
  }
}

function deleteRun(runId) {
  const db = openDb();
  try {
    db.prepare('DELETE FROM turns WHERE run_id = ?').run(runId);
    db.prepare('DELETE FROM runs WHERE id = ?').run(runId);
    return { deleted: runId };
  } finally {
    db.close();
  }
}

function safeJson(s) {
  try { return JSON.parse(s || 'null'); } catch { return null; }
}

module.exports = { saveRun, listRuns, getRun, deleteRun, openDb, getDbPath };
