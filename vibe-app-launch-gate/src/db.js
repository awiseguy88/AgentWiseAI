import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DB_PATH || join(dataDir, 'app.db');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL;');
db.exec('PRAGMA foreign_keys=ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'developer',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  owner_id INTEGER NOT NULL,
  reviewer_id INTEGER,
  current_release_id INTEGER,
  audience TEXT NOT NULL,
  data_scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  launch_blocked INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  data_scope TEXT NOT NULL,
  previous_data_scope TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_by INTEGER NOT NULL,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (app_id) REFERENCES apps(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  actor_id INTEGER,
  actor_username TEXT,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS governance_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL UNIQUE,
  owner_confirmed INTEGER NOT NULL DEFAULT 0,
  reviewer_signed_off INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (app_id) REFERENCES apps(id)
);

CREATE TABLE IF NOT EXISTS shadow_it_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'flagged',
  app_id INTEGER,
  resolved_action TEXT,
  resolved_by INTEGER,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (app_id) REFERENCES apps(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

export function nowIso() {
  return new Date().toISOString();
}

export function audit(action, actorId, actorUsername, targetType, targetId, details = {}) {
  db.prepare(`
    INSERT INTO audit_log (action, actor_id, actor_username, target_type, target_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(action, actorId ?? null, actorUsername ?? null, targetType, targetId ?? null, JSON.stringify(details), nowIso());
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}
export function getUserById(id) {
  return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
}
export function createUser(username, passwordHash, role = 'developer') {
  const res = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, passwordHash, role);
  return { id: Number(res.lastInsertRowid), username, role };
}
export function listUsers() {
  return db.prepare('SELECT id, username, role FROM users ORDER BY id').all();
}
