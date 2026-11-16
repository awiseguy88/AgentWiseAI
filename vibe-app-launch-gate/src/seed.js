import { db, createUser, audit } from './db.js';
import { hashPassword } from './auth.js';
import * as policy from './policy.js';

export function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) return false;
  const users = [
    ['dev-a', 'password', 'developer'],
    ['dev-b', 'password', 'developer'],
    ['reviewer-1', 'password', 'reviewer'],
    ['admin', 'password', 'admin'],
  ];
  for (const [u, p, r] of users) {
    createUser(u, hashPassword(p), r);
  }
  return true;
}

export function seedFixtureApp() {
  // Fixture used by tests/docker smoke: app owned by dev-a for team-b with read-only scope
  const devA = db.prepare("SELECT id FROM users WHERE username='dev-a'").get();
  const reviewer = db.prepare("SELECT id FROM users WHERE username='reviewer-1'").get();
  if (!devA || !reviewer) return null;
  const existing = db.prepare("SELECT id FROM apps WHERE name='fixture-app'").get();
  if (existing) return existing.id;
  const admin = db.prepare("SELECT id, username, role FROM users WHERE username='admin'").get();
  const app = policy.createApp({
    name: 'fixture-app',
    ownerId: devA.id,
    reviewerId: reviewer.id,
    audience: 'team-b',
    dataScope: 'read-only reports',
  }, admin);
  // approve the initial pending release and satisfy checklist so fixture is "live"
  const pending = app.releases.find(r => r.status === 'pending');
  if (pending) policy.decideRelease(pending.id, 'approve', 'seed', reviewer);
  policy.confirmOwnerChecklist(app.id, devA);
  policy.signOffReviewerChecklist(app.id, reviewer);
  return app.id;
}