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
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  args TEXT,
  risk_class TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  approval_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  args TEXT,
  risk_class TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  args TEXT,
  risk_class TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  approval_id INTEGER,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function nowIso() {
  return new Date().toISOString();
}

export function registerAgent(id, name) {
  const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  if (existing) return existing;
  db.prepare('INSERT INTO agents (id, name) VALUES (?, ?)').run(id, name);
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
}

export function getAgent(id) {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
}

export function listAgents() {
  return db.prepare('SELECT * FROM agents ORDER BY id').all();
}
