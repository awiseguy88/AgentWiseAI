'use strict';

// --- diff.js: minimal unified-diff parser ---
// Parses unified diff text into files and hunks. Only the hunk header (@@)
// and +/-/context lines are interpreted; everything else is header/noise.

function parsePath(header) {
  const m = header.match(/^diff --git a\/(.+) b\/(.+)$/);
  return m ? m[2] : header.replace(/^diff --git /, '');
}

function parseHunkHeader(line) {
  // @@ -oldStart,oldCount +newStart,newCount @@  (counts optional)
  const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!m) return null;
  return {
    oldStart: Number(m[1]),
    oldLines: m[2] !== undefined ? Number(m[2]) : 1,
    newStart: Number(m[3]),
    newLines: m[4] !== undefined ? Number(m[4]) : 1,
    lines: [],
  };
}

function classifyLine(raw) {
  if (raw.length === 0) return { type: 'context', content: '' };
  const first = raw[0];
  if (first === '+') return { type: 'added', content: raw.slice(1) };
  if (first === '-') return { type: 'removed', content: raw.slice(1) };
  if (first === ' ') return { type: 'context', content: raw.slice(1) };
  if (first === '\\') return { type: 'noop', content: raw };
  return { type: 'context', content: raw };
}

function parseDiff(text) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    if (raw.startsWith('diff --git ')) {
      if (currentFile && currentHunk) currentFile.hunks.push(currentHunk);
      currentHunk = null;
      currentFile = { header: raw, path: parsePath(raw), hunks: [] };
      files.push(currentFile);
      continue;
    }
    if (raw.startsWith('@@ ')) {
      if (currentFile && currentHunk) currentFile.hunks.push(currentHunk);
      currentHunk = parseHunkHeader(raw);
      if (currentFile) currentFile.hunks.push(currentHunk);
      continue;
    }
    if (currentHunk) {
      if (raw.startsWith('--- ') || raw.startsWith('+++ ')) continue;
      currentHunk.lines.push(classifyLine(raw));
    }
  }
  if (currentFile && currentHunk) currentFile.hunks.push(currentHunk);

  return { files };
}

module.exports = { parseDiff };
