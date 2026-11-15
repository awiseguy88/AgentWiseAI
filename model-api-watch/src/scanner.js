#!/usr/bin/env node
'use strict';

// Static/heuristic scanner: walks a project tree, extracts model IDs from
// source and config files, and reports each hit with file/line context.
// No network, no paid APIs, no accounts.

const fs = require('fs');
const path = require('path');
const { findEntry } = require('./registry');

const SCAN_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx',
  '.json', '.jsonc', '.yaml', '.yml', '.toml',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.php', '.sh', '.bash', '.env', '.cfg', '.ini', '.conf',
  '.md', '.mdx', '.txt', '.csv',
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next',
  '.nuxt', 'vendor', '__pycache__', '.venv', 'venv', '.idea',
  '.cache', '.turbo', '.output', 'coverage', '.nyc_output',
]);

// Matches common LLM model IDs: provider-prefixed tokens such as
// claude-sonnet-4-5, gemini-4-carbon, gpt-5.6-sol, o3, o3-mini, o4-mini, etc.
const MODEL_PATTERN = /\b(claude-[a-z0-9][\w.-]*|gemini-[a-z0-9][\w.-]*|gpt-[a-z0-9][\w.-]*|o\d(?:-[\w.-]+|\b)|llama-[a-z0-9][\w.-]*|mistral-[a-z0-9][\w.-]*|deepseek-[a-z0-9][\w.-]*|qwen-[a-z0-9][\w.-]*|phi-[a-z0-9][\w.-]*|sonnet-[a-z0-9][\w.-]*|haiku-[a-z0-9][\w.-]*)/gi;

function walk(dir, files = [], depth = 0) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      if (depth > 12) continue;
      walk(full, files, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext) || entry.name === '.env') {
        files.push(full);
      }
    }
  }
  return files;
}

function extractModelIds(content) {
  const ids = new Set();
  let match;
  MODEL_PATTERN.lastIndex = 0;
  while ((match = MODEL_PATTERN.exec(content)) !== null) {
    const id = match[1].toLowerCase();
    if (id.length < 4) continue;
    ids.add(id);
  }
  return ids;
}

function scanProject(root) {
  const files = walk(root);
  const findings = [];
  const stats = { filesScanned: files.length, modelsFound: 0 };
  const seen = new Set();

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      MODEL_PATTERN.lastIndex = 0;
      let match;
      while ((match = MODEL_PATTERN.exec(line)) !== null) {
        const id = match[1].toLowerCase();
        if (id.length < 4) continue;
        const entry = findEntry(id);
        if (!entry) continue;
        const key = `${file}:${i + 1}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          modelId: id,
          file: path.relative(root, file),
          line: i + 1,
          snippet: line.trim().slice(0, 120),
          entry,
        });
        stats.modelsFound += 1;
      }
    }
  }

  findings.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  return { root, stats, findings };
}

module.exports = { scanProject, walk, extractModelIds };