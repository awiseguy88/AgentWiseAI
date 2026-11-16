// Fixture coding agent: a minimal tool-calling agent backed by an in-memory
// SQLite database. Tools: SELECT, INSERT, UPDATE, DELETE. The agent is wrapped
// by the middleware so every tool call is intercepted against policy before it fires.

import { DatabaseSync } from 'node:sqlite';

export function createFixtureDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
    CREATE TABLE audit_events (id INTEGER PRIMARY KEY, message TEXT);
    INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
    INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com');
  `);
  return db;
}

// The fixture agent exposes a single entry point: callTool(tool, args).
// When wrapped by the middleware, the middleware decides whether the tool fires.
export function createFixtureAgent(agentId = 'fixture-agent-1') {
  const db = createFixtureDb();

  async function execute(tool, args) {
    const t = (tool || '').toUpperCase();
    if (t === 'SELECT') {
      const rows = db.prepare(args.query || 'SELECT * FROM users').all();
      return { ok: true, rows };
    }
    if (t === 'INSERT') {
      const info = db.prepare(args.query || 'INSERT INTO users (name, email) VALUES (?, ?)').run(args.name || 'x', args.email || 'x@y.z');
      return { ok: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
    if (t === 'UPDATE') {
      const info = db.prepare(args.query || 'UPDATE users SET name = ? WHERE id = ?').run(args.name || 'x', args.id || 1);
      return { ok: true, changes: info.changes };
    }
    if (t === 'DELETE') {
      const info = db.prepare(args.query || 'DELETE FROM users WHERE id = ?').run(args.id || 1);
      return { ok: true, changes: info.changes };
    }
    throw new Error(`Unknown tool: ${tool}`);
  }

  return { id: agentId, db, execute };
}