import { db, nowIso } from './db.js';

export function createApproval({ agent_id, tool, args, risk_class }) {
  const res = db.prepare(`
    INSERT INTO approvals (agent_id, tool, args, risk_class, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(agent_id, tool, args ? JSON.stringify(args) : null, risk_class, nowIso());
  return getApproval(Number(res.lastInsertRowid));
}

export function getApproval(id) {
  return db.prepare('SELECT * FROM approvals WHERE id = ?').get(id);
}

export function listApprovals(status = 'pending') {
  if (status === 'all') return db.prepare('SELECT * FROM approvals ORDER BY id DESC').all();
  return db.prepare('SELECT * FROM approvals WHERE status = ? ORDER BY id DESC').all(status);
}

export function decideApproval(id, decision, decidedBy = 'approver') {
  const appr = getApproval(id);
  if (!appr) throw new Error('Approval not found');
  if (appr.status !== 'pending') throw new Error('Approval already decided');
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Invalid decision');
  const decided_at = nowIso();
  db.prepare(`UPDATE approvals SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?`)
    .run(decision, decidedBy, decided_at, id);
  return getApproval(id);
}
