// @ts-check
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, upsertRepo, insertRun, resetAll } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadFixtures() {
  const p = join(__dirname, '..', 'test', 'fixtures', 'repos.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function seedFromFixtures(fixtures) {
  resetAll();
  const repos = [];
  for (const f of fixtures.repos) {
    const repo = upsertRepo({ owner: f.owner, name: f.name, default_branch: f.default_branch || 'main', workflow_yaml: f.workflow_yaml || null });
    for (const run of f.runs) {
      insertRun(repo.id, run);
    }
    repos.push(repo);
  }
  return repos;
}

export function ensureSeeded() {
  const count = db.prepare('SELECT COUNT(*) as c FROM repos').get().c;
  if (count === 0) {
    try {
      const fixtures = loadFixtures();
      seedFromFixtures(fixtures);
    } catch (e) {
      // no fixtures available; skip
    }
  }
}

// CLI entry
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fixtures = loadFixtures();
  const repos = seedFromFixtures(fixtures);
  console.log(`Seeded ${repos.length} repos from fixtures`);
}