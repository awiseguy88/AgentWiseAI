'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const { importTranscript } = require('./import');
const { listRuns, getRun, deleteRun } = require('./db');
const { writeReport } = require('./report');

const app = express();
const PORT = process.env.PORT || 3458;

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const UPLOADS_DIR = path.resolve(__dirname, '..', '.local', 'uploads');
const ALLOWED_EXTENSIONS = new Set(['.json', '.jsonl', '.txt', '.md', '.log']);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MiB
const MAX_JSON_BYTES = 2 * 1024 * 1024; // 2 MiB

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: MAX_JSON_BYTES }));

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Unsupported file extension: ${ext || '(none)'}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`));
    }
    cb(null, true);
  }
});

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'agent-output-quality-sentinel', version: '0.1.0' });
});

// Import transcript
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const filePath = safeUploadPath(req.file.path);
    const gateThreshold = req.body.gateThreshold ? Number(req.body.gateThreshold) : 60;
    const result = importTranscript(filePath, { gateThreshold, name: req.body.name || req.file.originalname });
    res.json({
      runId: result.runId,
      name: result.name,
      format: result.format,
      aggregate: result.aggregate,
      gate: result.gate,
      turnCount: result.turns.length
    });
  } catch (e) {
    console.error('import error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// List runs
app.get('/api/runs', async (_req, res) => {
  try {
    res.json(listRuns());
  } catch (e) {
    console.error('list runs error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Get full run
app.get('/api/runs/:id', async (req, res) => {
  try {
    const run = getRun(Number(req.params.id));
    if (!run) return res.status(404).json({ error: 'run not found' });
    res.json(run);
  } catch (e) {
    console.error('get run error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Delete a run
app.delete('/api/runs/:id', async (req, res) => {
  try {
    deleteRun(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    console.error('delete run error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Export report
app.get('/api/runs/:id/report', async (req, res) => {
  try {
    const { jsonPath, htmlPath, gatePass } = writeReport(Number(req.params.id));
    res.json({ jsonPath, htmlPath, gatePass });
  } catch (e) {
    console.error('report error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Reject uploaded paths that escape the intended upload directory.
function safeUploadPath(filePath) {
  const resolved = path.resolve(filePath);
  const rel = path.relative(UPLOADS_DIR, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`File path escapes upload directory: ${filePath}`);
  }
  return resolved;
}

app.listen(PORT, () => {
  console.log(`Agent Output Quality Sentinel running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser.`);
});

module.exports = app;
