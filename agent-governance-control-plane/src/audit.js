import { createHash } from 'node:crypto';
import { db, nowIso } from './db.js';

function computeHash(prevHash, entry) {
  const payload = JSON.stringify({
    prev_hash: prevHash || '',
    agent_id: entry.agent_id,
    tool: entry.tool,
    args: entry.args || '',
    risk_class: entry.risk_class,
    decision: entry.decision,
    reason: entry.reason || '',
    approval_id: entry.approval_id ?? null,
    created_at: entry.created_at,
  });
  return createHash('sha256').update(payload).digest('hex');
}

function lastHash() {
  const row = db.prepare('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1').get();
  return row ? row.hash : null;
}

export function recordAudit(entry) {
  const created_at = nowIso();
  const prev = lastHash();
  const hash = computeHash(prev, { ...entry, created_at });
  const res = db.prepare(`
    INSERT INTO audit_log (agent_id, tool, args, risk_class, decision, reason, approval_id, prev_hash, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.agent_id,
    entry.tool,
    entry.args ? JSON.stringify(entry.args) : null,
    entry.risk_class,
    entry.decision,
    entry.reason || null,
    entry.approval_id ?? null,
    prev,
    hash,
    created_at,
  );
  return { id: Number(res.lastInsertRowid), ...entry, created_at, prev_hash: prev, hash };
}

export function listAudit(filters = {}) {
  let sql = 'SELECT * FROM audit_log';
  const where = [];
  const params = [];
  if (filters.agent_id) { where.push('agent_id = ?'); params.push(filters.agent_id); }
  if (filters.decision) { where.push('decision = ?'); params.push(filters.decision); }
  if (filters.tool) { where.push('tool = ?'); params.push(filters.tool); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY id DESC';
  if (filters.limit) { sql += ' LIMIT ?'; params.push(Number(filters.limit)); }
  return db.prepare(sql).all(...params);
}

export function verifyAudit() {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id ASC').all();
  let prev = null;
  let tampered = 0;
  const bad = [];
  for (const r of rows) {
    if (r.prev_hash !== prev) { tampered++; bad.push(r.id); }
    const recomputed = computeHash(r.prev_hash, {
      agent_id: r.agent_id,
      tool: r.tool,
      args: r.args ? JSON.parse(r.args) : null,
      risk_class: r.risk_class,
      decision: r.decision,
      reason: r.reason,
      approval_id: r.approval_id,
      created_at: r.created_at,
    });
    if (recomputed !== r.hash) { tampered++; bad.push(r.id); }
    prev = r.hash;
  }
  return { total: rows.length, tampered: tampered > 0, tampered_count: tampered, bad_ids: bad };
}
