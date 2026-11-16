'use strict';

const fs = require('fs');
const path = require('path');

const TEST_DIR_NAMES = ['test', 'tests', '__tests__', 'spec'];
const TEST_RE = /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs|py)$/i;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(p, out);
      } else if (TEST_RE.test(entry.name)) {
        out.push(p);
      }
    }
  } catch {}
}

function loadBundledTasks(toolRoot) {
  const dir = path.join(toolRoot, 'tasks');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    t.source = 'bundled';
    return t;
  });
}

function extractRepoTasks(repoPath) {
  const files = [];
  for (const name of TEST_DIR_NAMES) walk(path.join(repoPath, name), files);
  if (fs.existsSync(repoPath)) {
    try {
      for (const entry of fs.readdirSync(repoPath, { withFileTypes: true })) {
        if (entry.isFile() && TEST_RE.test(entry.name)) files.push(path.join(repoPath, entry.name));
      }
    } catch {}
  }
  const uniq = Array.from(new Set(files)).sort();
  return uniq.map((fp) => {
    const rel = path.relative(repoPath, fp);
    let content = '';
    try { content = fs.readFileSync(fp, 'utf8').slice(0, 4000); } catch {}
    const tests = [];
    const re = /\b(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let m;
    while ((m = re.exec(content))) tests.push(m[1]);
    const intent = tests.length ? tests.join('; ') : rel;
    const prompt = `You are given a repository with a test file "${rel}".\nTest intent: ${intent}\n\nRelevant test excerpt:\n${content.slice(0, 1200)}\n\nExplain or provide the code change needed so these tests would pass. Be concrete.`;

// derive expected keywords from intent/filenames for offline checking
    const keywords = intent.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3).slice(0, 4);
    return {
      id: rel.replace(/[^a-zA-Z0-9._-]+/g, '-'),
      title: `Repo test: ${rel}`,
      type: 'repo',
      source: 'repo',
      path: rel,
      prompt,
      checker: keywords.length ? { containsAny: keywords } : {},
    };
  });
}

module.exports = { loadBundledTasks, extractRepoTasks };