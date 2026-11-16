'use strict';

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.STUDIO_DB_PATH || path.resolve(__dirname, '..', '.local', 'studio.db');

function openDb() {
  const db = new DatabaseSync(DB_PATH);
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
      summary_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      turn_index INTEGER,
      claim_text TEXT,
      claim_type TEXT,
      status TEXT,
      reasons_json TEXT,
      evidence_json TEXT
    );

    CREATE TABLE IF NOT EXISTS drift_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      type TEXT,
      severity TEXT,
      step_indices_json TEXT,
      message TEXT,
      metric_json TEXT
    );

    CREATE TABLE IF NOT EXISTS drift_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      step_index INTEGER,
      name TEXT,
      type TEXT,
      span TEXT,
      duration_ms INTEGER,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      quality REAL,
      input_preview TEXT,
      output_preview TEXT,
      signature TEXT,
      output_signature TEXT
    );
  `);
}

function saveRun(runData) {
  const db = openDb();
  try {
    const { name, sourcePath, transcriptFormat, summary, claims = [], driftAlerts = [], driftSteps = [] } = runData;
    const summaryJson = JSON.stringify(summary || {});
    const stmt = db.prepare(
      'INSERT INTO runs (name, source_path, transcript_format, summary_json) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(name, sourcePath || null, transcriptFormat || null, summaryJson);
    const runId = result.lastInsertRowid;

    const claimStmt = db.prepare(
      `INSERT INTO claims (run_id, turn_index, claim_text, claim_type, status, reasons_json, evidence_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of claims) {
      claimStmt.run(runId, c.turnIndex ?? null, c.claimText ?? null, c.claimType ?? null, c.status ?? null, JSON.stringify(c.reasons || []), JSON.stringify(c.evidence || {}));
    }

    const alertStmt = db.prepare(
      `INSERT INTO drift_alerts (run_id, type, severity, step_indices_json, message, metric_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const a of driftAlerts) {
      alertStmt.run(runId, a.type ?? null, a.severity ?? null, JSON.stringify(a.steps || []), a.message ?? null, JSON.stringify(a.metric || {}));
    }

    const stepStmt = db.prepare(
      `INSERT INTO drift_steps (run_id, step_index, name, type, span, duration_ms, prompt_tokens, completion_tokens, total_tokens, quality, input_preview, output_preview, signature, output_signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of driftSteps) {
      stepStmt.run(runId, s.index ?? null, s.name ?? null, s.type ?? null, s.span ?? null, s.duration_ms ?? null, s.prompt_tokens ?? null, s.completion_tokens ?? null, s.total_tokens ?? null, s.quality ?? null, s.input_preview ?? null, s.output_preview ?? null, s.signature ?? null, s.output_signature ?? null);
    }

    return { runId, name, importedAt: new Date().toISOString() };
  } finally {
    db.close();
  }
}

function listRuns() {
  const db = openDb();
  try {
    const stmt = db.prepare('SELECT id, name, source_path, transcript_format, imported_at, summary_json FROM runs ORDER BY imported_at DESC');
    const rows = stmt.all();
    return rows.map(r => ({ ...r, summary: JSON.parse(r.summary_json || '{}') }));
  } finally {
    db.close();
  }
}

function getRun(runId) {
  const db = openDb();
  try {
    const runStmt = db.prepare('SELECT id, name, source_path, transcript_format, imported_at, summary_json FROM runs WHERE id = ?');
    const run = runStmt.get(runId);
    if (!run) return null;
    const claimsStmt = db.prepare('SELECT turn_index, claim_text, claim_type, status, reasons_json, evidence_json FROM claims WHERE run_id = ? ORDER BY id');
    const claims = claimsStmt.all(runId);
    const alertsStmt = db.prepare('SELECT type, severity, step_indices_json, message, metric_json FROM drift_alerts WHERE run_id = ? ORDER BY id');
    const alerts = alertsStmt.all(runId);
    const stepsStmt = db.prepare('SELECT step_index, name, type, span, duration_ms, prompt_tokens, completion_tokens, total_tokens, quality, input_preview, output_preview, signature, output_signature FROM drift_steps WHERE run_id = ? ORDER BY id');
    const steps = stepsStmt.all(runId);
    return {
      id: run.id,
      name: run.name,
      sourcePath: run.source_path,
      transcriptFormat: run.transcript_format,
      importedAt: run.imported_at,
      summary: JSON.parse(run.summary_json || '{}'),
      claims: claims.map(c => ({
        turnIndex: c.turn_index,
        claimText: c.claim_text,
        claimType: c.claim_type,
        status: c.status,
        reasons: JSON.parse(c.reasons_json || '[]'),
        evidence: JSON.parse(c.evidence_json || '{}')
      })),
      driftAlerts: alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        steps: JSON.parse(a.step_indices_json || '[]'),
        message: a.message,
        metric: JSON.parse(a.metric_json || '{}')
      })),
      driftSteps: steps.map(s => ({
        index: s.step_index,
        name: s.name,
        type: s.type,
        span: s.span,
        duration_ms: s.duration_ms,
        prompt_tokens: s.prompt_tokens,
        completion_tokens: s.completion_tokens,
        total_tokens: s.total_tokens,
        quality: s.quality,
        input_preview: s.input_preview,
        output_preview: s.output_preview,
        signature: s.signature,
        output_signature: s.output_signature
      }))
    };
  } finally {
    db.close();
  }
}

function deleteRun(runId) {
  const db = openDb();
  try {
    const stmt = db.prepare('DELETE FROM runs WHERE id = ?');
    stmt.run(runId);
    return { deleted: runId };
  } finally {
    db.close();
  }
}

module.exports = { saveRun, listRuns, getRun, deleteRun, DB_PATH };