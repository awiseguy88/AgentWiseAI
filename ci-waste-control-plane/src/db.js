// @ts-check
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DB_PATH || join(dataDir, 'ci-waste.db');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL;');
db.exec('PRAGMA foreign_keys=ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  workflow_yaml TEXT,
  UNIQUE(owner, name)
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL,
  workflow_id INTEGER NOT NULL,
  workflow_name TEXT NOT NULL,
  run_number INTEGER,
  event TEXT NOT NULL,
  status TEXT,
  conclusion TEXT,
  head_branch TEXT,
  head_sha TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  run_started_at TEXT,
  duration_minutes REAL NOT NULL DEFAULT 0,
  has_timeout INTEGER NOT NULL DEFAULT 1,
  raw_json TEXT,
  FOREIGN KEY (repo_id) REFERENCES repos(id)
);

CREATE TABLE IF NOT EXISTS waste_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  run_id INTEGER,
  workflow_name TEXT,
  category TEXT NOT NULL,
  recoverable_minutes REAL NOT NULL DEFAULT 0,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (repo_id) REFERENCES repos(id)
);

CREATE TABLE IF NOT EXISTS remediation_prs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  diff TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  status TEXT NOT NULL DEFAULT 'dry-run',
  estimated_minutes_saved REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (repo_id) REFERENCES repos(id)
);
`);

export function upsertRepo({ owner, name, default_branch = 'main', workflow_yaml = null }) {
  const stmt = db.prepare(
    'INSERT INTO repos (owner, name, default_branch, workflow_yaml) VALUES (?,?,?,?) ' +
    'ON CONFLICT(owner,name) DO UPDATE SET default_branch=excluded.default_branch, workflow_yaml=excluded.workflow_yaml'
  );
  stmt.run(owner, name, default_branch, workflow_yaml);
  return db.prepare('SELECT * FROM repos WHERE owner=? AND name=?').get(owner, name);
}

export function insertRun(repoId, run) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO runs
    (id, repo_id, workflow_id, workflow_name, run_number, event, status, conclusion, head_branch, head_sha, attempt, created_at, updated_at, run_started_at, duration_minutes, has_timeout, raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  stmt.run(
    run.id, repoId, run.workflow_id, run.workflow_name, run.run_number ?? null,
    run.event, run.status ?? null, run.conclusion ?? null, run.head_branch ?? null,
    run.head_sha ?? null, run.attempt ?? 1, run.created_at, run.updated_at ?? null,
    run.run_started_at ?? null, run.duration_minutes ?? 0, run.has_timeout ? 1 : 0,
    JSON.stringify(run)
  );
}

export function getRepos() { return db.prepare('SELECT * FROM repos ORDER BY id').all(); }
export function getRepoById(id) { return db.prepare('SELECT * FROM repos WHERE id=?').get(id); }
export function getRunsForRepo(repoId) { return db.prepare('SELECT * FROM runs WHERE repo_id=? ORDER BY created_at ASC, id ASC').all(repoId); }

export function clearFindings(repoId) {
  db.prepare('DELETE FROM waste_findings WHERE repo_id=?').run(repoId);
}
export function insertFinding(f) {
  db.prepare('INSERT INTO waste_findings (repo_id, run_id, workflow_name, category, recoverable_minutes, detail) VALUES (?,?,?,?,?,?)')
    .run(f.repo_id, f.run_id ?? null, f.workflow_name ?? null, f.category, f.recoverable_minutes ?? 0, f.detail ?? null);
}
export function getFindings(repoId) { return db.prepare('SELECT * FROM waste_findings WHERE repo_id=?').all(repoId); }

export function insertRemediation(r) {
  const res = db.prepare('INSERT INTO remediation_prs (repo_id, category, title, body, diff, pr_number, pr_url, status, estimated_minutes_saved) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(r.repo_id, r.category, r.title, r.body ?? null, r.diff ?? null, r.pr_number ?? null, r.pr_url ?? null, r.status ?? 'dry-run', r.estimated_minutes_saved ?? 0);
  return db.prepare('SELECT * FROM remediation_prs WHERE id=?').get(Number(res.lastInsertRowid));
}
export function getRemediations(repoId) { return db.prepare('SELECT * FROM remediation_prs WHERE repo_id=?').all(repoId); }
export function clearRemediations(repoId) { db.prepare('DELETE FROM remediation_prs WHERE repo_id=?').run(repoId); }

export function resetAll() {
  db.exec('DELETE FROM remediation_prs; DELETE FROM waste_findings; DELETE FROM runs; DELETE FROM repos;');
}