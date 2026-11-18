'use strict';

const fs = require('fs');
const path = require('path');
const { parseTranscript } = require('./parser');
const { computeRunMetrics, gateResult } = require('./metrics');
const { saveRun } = require('./db');

const ALLOWED_EXTENSIONS = new Set(['.json', '.jsonl', '.txt', '.md', '.log']);

function DEFAULT_NAME(filePath) {
  return path.basename(filePath);
}

function validateFilePath(filePath) {
  if (!filePath) throw new Error('file path is required');
  if (String(filePath).includes('\0')) throw new Error('invalid file path');
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file extension: ${ext || '(none)'}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`);
  }
  const resolved = path.resolve(filePath);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (e) {
    throw new Error(`File not found or unreadable: ${resolved}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Not a regular file: ${resolved}`);
  }
  return resolved;
}

function importTranscript(filePath, options = {}) {
  const safePath = validateFilePath(filePath);
  const name = options.name || DEFAULT_NAME(safePath);
  const format = path.extname(safePath).toLowerCase() === '.jsonl' ? 'jsonl' :
    path.extname(safePath).toLowerCase() === '.json' ? 'json' : 'plain-text';
  const rawTurns = parseTranscript(safePath);
  const { perTurn, aggregate } = computeRunMetrics(rawTurns);
  const threshold = options.gateThreshold || 60;
  const gate = gateResult(aggregate, perTurn, threshold);
  const saved = saveRun({ name, sourcePath: safePath, transcriptFormat: format, aggregate, gate, turns: perTurn });
  return { ...saved, name, format, aggregate, gate, turns: perTurn };
}

module.exports = { importTranscript, validateFilePath, ALLOWED_EXTENSIONS };
