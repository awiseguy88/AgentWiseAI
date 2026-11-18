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
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pr_review_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  html_url TEXT,
  lines INTEGER NOT NULL,
  files INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'sprawl',
  rescope_action TEXT,
  rescope_recorded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo, pr_number)
);

CREATE TABLE IF NOT EXISTS webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo TEXT,
  event TEXT,
  pr_number INTEGER,
  signature_valid INTEGER NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function getConfig(key, fallback) {
  const row = db.prepare('SELECT value FROM config WHERE key=?').get(key);
  return row ? row.value : fallback;
}

export function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
}

export function listItems() {
  return db.prepare('SELECT * FROM pr_review_items ORDER BY created_at DESC').all();
}

export function findItem(repo, prNumber) {
  return db.prepare('SELECT * FROM pr_review_items WHERE repo=? AND pr_number=?').get(repo, prNumber);
}

export function upsertItem(item) {
  const existing = findItem(item.repo, item.pr_number);
  if (existing) {
    db.prepare(`
      UPDATE pr_review_items
      SET title=?, author=?, html_url=?, lines=?, files=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `).run(item.title, item.author, item.html_url, item.lines, item.files, item.status, existing.id);
    return findItem(item.repo, item.pr_number);
  }
  db.prepare(`
    INSERT INTO pr_review_items (repo, pr_number, title, author, html_url, lines, files, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.repo, item.pr_number, item.title, item.author, item.html_url, item.lines, item.files, item.status);
  return findItem(item.repo, item.pr_number);
}

export function rescopeItem(id, action) {
  db.prepare(`
    UPDATE pr_review_items
    SET status='rescope', rescope_action=?, rescope_recorded_at=datetime('now'), updated_at=datetime('now')
    WHERE id=?
  `).run(action, id);
  return db.prepare('SELECT * FROM pr_review_items WHERE id=?').get(id);
}

export function logWebhook(entry) {
  db.prepare(`
    INSERT INTO webhook_log (repo, event, pr_number, signature_valid, error)
    VALUES (?, ?, ?, ?, ?)
  `).run(entry.repo || null, entry.event || null, entry.pr_number || null,
    entry.signature_valid ? 1 : 0, entry.error || null);
}

export function listWebhookLog(limit = 50) {
  return db.prepare('SELECT * FROM webhook_log ORDER BY id DESC LIMIT ?').all(limit);
}