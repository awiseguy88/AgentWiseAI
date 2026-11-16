import { db, nowIso, audit } from './db.js';

const ADMIN = 'admin';
const REVIEWER = 'reviewer';
const DEVELOPER = 'developer';

function appRow(id) {
  return db.prepare(`
    SELECT a.*, o.username as owner_name, r.username as reviewer_name
    FROM apps a
    LEFT JOIN users o ON a.owner_id = o.id
    LEFT JOIN users r ON a.reviewer_id = r.id
    WHERE a.id = ?
  `).get(id);
}

function userRow(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function actor(user) {
  return { id: user.id, username: user.username, role: user.role };
}

export function canManageApp(app, user) {
  return user.role === ADMIN || app.owner_id === user.id;
}
export function canReview(app, user) {
  return user.role === ADMIN || app.reviewer_id === user.id || user.role === REVIEWER;
}

export function createApp({ name, ownerId, reviewerId, audience, dataScope }, user) {
  if (!name || !audience || !dataScope) throw new Error('name, audience and data_scope are required');
  const owner = ownerId ? userRow(ownerId) : user;
  if (!owner) throw new Error('owner not found');
  const reviewer = reviewerId ? userRow(reviewerId) : null;
  if (reviewerId && !reviewer) throw new Error('reviewer not found');
  const existing = db.prepare('SELECT id FROM apps WHERE name = ?').get(name);
  if (existing) throw new Error(`app "${name}" already registered`);

  const stmt = db.prepare(`
    INSERT INTO apps (name, owner_id, reviewer_id, audience, data_scope, status, launch_blocked)
    VALUES (?, ?, ?, ?, ?, 'draft', 1)
  `);
  const res = stmt.run(name, owner.id, reviewer?.id ?? null, audience, dataScope);
  const id = Number(res.lastInsertRowid);

  db.prepare('INSERT INTO governance_checklists (app_id) VALUES (?)').run(id);

  const a = actor(user);
  audit('app_registered', a.id, a.username, 'app', id, { name, owner: owner.username, reviewer: reviewer?.username || null, audience, dataScope, status: 'draft', launchBlocked: true });

  // First release must also go through approval gate for the initially recorded release/scope
  const relRes = db.prepare(`
    INSERT INTO releases (app_id, version, data_scope, previous_data_scope, status, submitted_by)
    VALUES (?, '1.0.0', ?, NULL, 'pending', ?)
  `).run(id, dataScope, owner.id);
  audit('release_submitted', owner.id, owner.username, 'release', Number(relRes.lastInsertRowid), { appId: id, version: '1.0.0', dataScope, changeType: 'initial' });

  return getApp(id);
}

export function getApp(id) {
  const app = appRow(id);
  if (!app) return null;
  const checklist = getChecklist(id);
  const releases = listReleases(id);
  const launchGate = evaluateLaunchGate(app, checklist, releases);
  return { ...app, checklist, releases, launchGate };
}

export function listApps() {
  return db.prepare(`
    SELECT a.*, o.username as owner_name, r.username as reviewer_name,
      (SELECT r2.version FROM releases r2 WHERE r2.app_id = a.id AND r2.status='approved' ORDER BY r2.id DESC LIMIT 1) as live_version,
      (SELECT COUNT(*) FROM releases r3 WHERE r3.app_id = a.id AND r3.status='pending') as pending_releases
    FROM apps a
    LEFT JOIN users o ON a.owner_id = o.id
    LEFT JOIN users r ON a.reviewer_id = r.id
    ORDER BY a.id
  `).all();
}

export function submitRelease(appId, version, dataScope, user) {
  const app = appRow(appId);
  if (!app) throw new Error('App not found');
  if (!canManageApp(app, user)) throw new Error('Only the owner or admin can submit a release');

  const previous = db.prepare(`
    SELECT data_scope FROM releases WHERE app_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 1
  `).get(appId);

  const stmt = db.prepare(`
    INSERT INTO releases (app_id, version, data_scope, previous_data_scope, status, submitted_by)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);
  const res = stmt.run(appId, version, dataScope, previous?.data_scope || null, user.id);
  const releaseId = Number(res.lastInsertRowid);
  // Until approved, the new release must not reach users. Mark app as needing review.
  db.prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?').run('pending_review', nowIso(), appId);

  audit('release_submitted', user.id, user.username, 'release', releaseId, {
    appId, version, requestedScope: dataScope, previousScope: previous?.data_scope || null,
    changeType: previous ? (previous.data_scope !== dataScope ? 'scope_change' : 'scope_same') : 'initial',
  });

  return getRelease(releaseId);
}

function getRelease(id) {
  const r = db.prepare(`
    SELECT r.*, u.username as submitted_by_name, u2.username as reviewed_by_name
    FROM releases r
    LEFT JOIN users u ON r.submitted_by = u.id
    LEFT JOIN users u2 ON r.reviewed_by = u2.id
    WHERE r.id = ?
  `).get(id);
  return r;
}

export function listReleases(appId) {
  return db.prepare(`
    SELECT r.*, u.username as submitted_by_name, u2.username as reviewed_by_name
    FROM releases r
    LEFT JOIN users u ON r.submitted_by = u.id
    LEFT JOIN users u2 ON r.reviewed_by = u2.id
    WHERE r.app_id = ?
    ORDER BY r.id DESC
  `).all(appId);
}

export function decideRelease(releaseId, decision, note, user) {
  const release = getRelease(releaseId);
  if (!release) throw new Error('Release not found');
  const app = appRow(release.app_id);
  if (!app) throw new Error('App not found for release');
  if (!canReview(app, user)) throw new Error('Only the designated reviewer or admin can decide releases');
  if (release.status !== 'pending') throw new Error('Release already decided');

  const status = decision === 'approve' ? 'approved' : 'rejected';
  db.prepare(`
    UPDATE releases SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?
  `).run(status, user.id, nowIso(), releaseId);

  if (status === 'approved') {
    // Only an approved release becomes the live release.
    db.prepare('UPDATE apps SET current_release_id = ?, data_scope = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(releaseId, release.data_scope, 'active', nowIso(), app.id);
  } else {
    // Rejected release does not go live; previous live release stays active.
    const otherPending = db.prepare(`SELECT COUNT(*) c FROM releases WHERE app_id=? AND status='pending'`).get(app.id);
    if (otherPending.c === 0) {
      db.prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?').run('active', nowIso(), app.id);
    }
  }

  audit(`release_${status === 'approved' ? 'approved' : 'rejected'}`, user.id, user.username, 'release', releaseId, {
    appId: app.id, version: release.version, requestedScope: release.data_scope,
    previousScope: release.previous_data_scope, note: note || null,
    scopeChange: release.previous_data_scope !== null && release.previous_data_scope !== release.data_scope,
  });

  return getRelease(releaseId);
}

export function changeOwnership(appId, newOwnerId, user) {
  const app = appRow(appId);
  if (!app) throw new Error('App not found');
  if (!canManageApp(app, user)) throw new Error('Only the owner or admin can change ownership');
  const newOwner = userRow(newOwnerId);
  if (!newOwner) throw new Error('New owner not found');
  if (newOwnerId === app.owner_id) throw new Error('App already owned by that user');

  const oldOwner = userRow(app.owner_id);
  db.prepare('UPDATE apps SET owner_id = ?, updated_at = ? WHERE id = ?').run(newOwnerId, nowIso(), appId);
  audit('ownership_changed', user.id, user.username, 'app', appId, {
    name: app.name, fromOwnerId: app.owner_id, fromOwner: oldOwner?.username, toOwnerId: newOwnerId, toOwner: newOwner.username,
  });
  return getApp(appId);
}

export function getChecklist(appId) {
  const row = db.prepare('SELECT * FROM governance_checklists WHERE app_id = ?').get(appId);
  return row || { app_id: appId, owner_confirmed: 0, reviewer_signed_off: 0, created_at: nowIso(), updated_at: nowIso() };
}

export function confirmOwnerChecklist(appId, user) {
  const app = appRow(appId);
  if (!app) throw new Error('App not found');
  if (app.owner_id !== user.id && user.role !== ADMIN) throw new Error('Only the owner or admin can confirm the data scope');
  db.prepare(`
    UPDATE governance_checklists SET owner_confirmed = 1, updated_at = ? WHERE app_id = ?
  `).run(nowIso(), appId);
  audit('checklist_owner_confirmed', user.id, user.username, 'app', appId, { name: app.name, dataScope: app.data_scope });
  return { ...getApp(appId), launchGate: evaluateLaunchGate(appRow(appId), getChecklist(appId), listReleases(appId)) };
}

export function signOffReviewerChecklist(appId, user) {
  const app = appRow(appId);
  if (!app) throw new Error('App not found');
  if (!canReview(app, user)) throw new Error('Only the designated reviewer or admin can sign off');
  db.prepare(`
    UPDATE governance_checklists SET reviewer_signed_off = 1, updated_at = ? WHERE app_id = ?
  `).run(nowIso(), appId);
  audit('checklist_reviewer_signed_off', user.id, user.username, 'app', appId, { name: app.name, reviewer: app.reviewer_name });
  return { ...getApp(appId), launchGate: evaluateLaunchGate(appRow(appId), getChecklist(appId), listReleases(appId)) };
}

export function evaluateLaunchGate(app, checklist, releases) {
  const blocked = [];
  if (!app) return { blocked: true, reasons: ['app not found'] };
  if (app.status === 'shadow_it') blocked.push('shadow IT — register or formally retire before deployment');
  if (!app.owner_id) blocked.push('no owner assigned');
  if (!app.audience) blocked.push('no intended audience recorded');
  if (!app.data_scope) blocked.push('no data access scope recorded');
  if (!(checklist && checklist.owner_confirmed)) blocked.push('owner has not confirmed data scope');
  if (!(checklist && checklist.reviewer_signed_off)) blocked.push('reviewer has not signed off');
  const pending = (releases || []).filter(r => r.status === 'pending');
  if (pending.length) blocked.push(`release approval pending (${pending.map(r => r.version).join(', ')})`);
  const live = (releases || []).find(r => r.status === 'approved');
  return { blocked: blocked.length > 0, reasons: blocked, pendingReleases: pending.map(r => r.id), liveRelease: live ? { id: live.id, version: live.version, dataScope: live.data_scope } : null };
}

export function receiveCIReport(payload, source = 'ci-webhook', user = null) {
  // payload: { app_name?, changed_files?: string[], repo?, actor? }
  const changed = Array.isArray(payload.changed_files) ? payload.changed_files : [];
  const appName = payload.app_name || (changed.length ? changed[0] : null);
  let app = appName ? db.prepare('SELECT * FROM apps WHERE name = ?').get(appName) : null;

  const res = db.prepare(`
    INSERT INTO shadow_it_reports (source, payload, status, app_id)
    VALUES (?, ?, 'flagged', ?)
  `).run(source, JSON.stringify(payload), app?.id || null);
  const reportId = Number(res.lastInsertRowid);

  if (!app) {
    audit('shadow_it_detected', user?.id || null, user?.username || 'ci', 'shadow_it', reportId, {
      source, appName, changedFiles: changed, message: 'Detected changes outside the app registry',
    });
    return { reportId, shadowIt: true, message: 'Shadow IT flagged; deployment blocked until registered or retired' };
  }

  // Registered app reported by CI still needs approval gate; record the event
  audit('ci_report_for_registered_app', user?.id || null, user?.username || 'ci', 'shadow_it', reportId, {
    source, appName: app.name, appId: app.id, changedFiles: changed,
  });
  return { reportId, shadowIt: false, appId: app.id, message: 'Report attached to registered app' };
}

export function listShadowIt() {
  return db.prepare(`
    SELECT s.*, a.name as app_name, u.username as resolved_by_name
    FROM shadow_it_reports s
    LEFT JOIN apps a ON s.app_id = a.id
    LEFT JOIN users u ON s.resolved_by = u.id
    ORDER BY s.id DESC
  `).all();
}

export function resolveShadowIt(reportId, action, appId, user) {
  const report = db.prepare('SELECT * FROM shadow_it_reports WHERE id = ?').get(reportId);
  if (!report) throw new Error('Shadow IT report not found');
  if (report.status !== 'flagged') throw new Error('Report already resolved');
  if (!['register', 'retire'].includes(action)) throw new Error('action must be register or retire');

  let targetAppId = appId;
  if (action === 'register') {
    if (!appId) throw new Error('app_id required to register shadow IT');
    const app = appRow(appId);
    if (!app) throw new Error('Target app not found');
    db.prepare('UPDATE apps SET status = ?, launch_blocked = ?, updated_at = ? WHERE id = ?').run('draft', 1, nowIso(), appId);
    targetAppId = appId;
  }

  db.prepare(`
    UPDATE shadow_it_reports SET status = ?, app_id = ?, resolved_action = ?, resolved_by = ?, resolved_at = ? WHERE id = ?
  `).run('resolved', targetAppId ?? null, action, user.id, nowIso(), reportId);

  audit('shadow_it_resolved', user.id, user.username, 'shadow_it', reportId, { action, appId: targetAppId ?? null, appName: targetAppId ? appRow(targetAppId)?.name : null });
  return listShadowIt().find(r => r.id === reportId);
}

export function listAudit(filters = {}) {
  let sql = 'SELECT * FROM audit_log';
  const where = [];
  const params = [];
  if (filters.action) { where.push('action = ?'); params.push(filters.action); }
  if (filters.actor) { where.push('actor_username = ?'); params.push(filters.actor); }
  if (filters.targetType) { where.push('target_type = ?'); params.push(filters.targetType); }
  if (filters.targetId) { where.push('target_id = ?'); params.push(Number(filters.targetId)); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY id DESC';
  if (filters.limit) { sql += ' LIMIT ?'; params.push(Number(filters.limit)); }
  return db.prepare(sql).all(...params);
}

export function stats() {
  return {
    apps: db.prepare('SELECT COUNT(*) c FROM apps').get().c,
    blockedApps: db.prepare(`SELECT COUNT(*) c FROM apps a WHERE EXISTS(SELECT 1 FROM governance_checklists g WHERE g.app_id=a.id AND (g.owner_confirmed=0 OR g.reviewer_signed_off=0)) OR a.status='shadow_it'`).get().c,
    pendingReleases: db.prepare(`SELECT COUNT(*) c FROM releases WHERE status='pending'`).get().c,
    openShadowIt: db.prepare(`SELECT COUNT(*) c FROM shadow_it_reports WHERE status='flagged'`).get().c,
    auditEntries: db.prepare('SELECT COUNT(*) c FROM audit_log').get().c,
  };
}