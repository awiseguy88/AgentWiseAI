import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

let sqlite;
let pgPool;
let driver;

function getDriver() {
  if (driver) return driver;
  driver = process.env.DATABASE_URL ? 'pg' : 'sqlite';
  return driver;
}

export function getDb() {
  if (getDriver() === 'pg') {
    if (!pgPool) {
      pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    }
    return { kind: 'pg', pool: pgPool };
  }
  if (!sqlite) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'app.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    sqlite = new DatabaseSync(dbPath);
  }
  return { kind: 'sqlite', sqlite };
}

export async function run(sql, params = []) {
  const db = getDb();
  if (db.kind === 'pg') {
    const res = await db.pool.query(sql, params);
    return { rowCount: res.rowCount, rows: res.rows };
  }
  const ssql = sql.replace(/\$\d+/g, '?');
  const stmt = db.sqlite.prepare(ssql);
  const info = stmt.run(...params);
  return { rowCount: info.changes, rows: [] };
}

export async function query(sql, params = []) {
  const db = getDb();
  if (db.kind === 'pg') {
    const res = await db.pool.query(sql, params);
    return res.rows;
  }
  const ssql = sql.replace(/\$\d+/g, '?');
  const stmt = db.sqlite.prepare(ssql);
  return stmt.all(...params);
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function initSchema() {
  const db = getDb();
  const isPg = db.kind === 'pg';
  const idCol = isPg ? 'id BIGSERIAL PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT';
  const tsDefault = isPg ? 'CURRENT_TIMESTAMP' : "CURRENT_TIMESTAMP";
  const boolDefault = '0';
  const stmts = [
    `CREATE TABLE IF NOT EXISTS runs (
      ${idCol},
      task_id TEXT NOT NULL,
      session_id TEXT,
      repo TEXT NOT NULL,
      pr_number INTEGER,
      engineer_id TEXT,
      team_id TEXT,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      rate_card TEXT,
      turn INTEGER NOT NULL DEFAULT 1,
      merged INTEGER NOT NULL DEFAULT ${boolDefault},
      accepted INTEGER NOT NULL DEFAULT ${boolDefault},
      merged_at TIMESTAMP,
      failed INTEGER NOT NULL DEFAULT ${boolDefault},
      failed_at TIMESTAMP,
      source TEXT NOT NULL DEFAULT 'litellm',
      created_at TIMESTAMP NOT NULL DEFAULT ${tsDefault}
    )`,
    'CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_runs_repo_pr ON runs(repo, pr_number)',
    'CREATE INDEX IF NOT EXISTS idx_runs_engineer ON runs(engineer_id)',
  ];
  for (const s of stmts) {
    await run(s);
  }
}