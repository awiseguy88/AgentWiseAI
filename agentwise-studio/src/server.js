'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const { importTranscript } = require('./import');
const { listRuns, getRun, deleteRun } = require('./db');
const { compareRuns } = require('./compare');

const app = express();
const PORT = process.env.PORT || 3456;

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const UPLOADS_DIR = path.resolve(__dirname, '..', '.local', 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

const upload = multer({ dest: UPLOADS_DIR });

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'agentwise-studio', version: '0.1.0' });
});

// Import transcript
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const filePath = req.file.path;
    const result = await importTranscript(filePath);
    res.json({
      runId: result.runId,
      name: result.name,
      importedAt: result.importedAt,
      summary: result.claimAnalysis.summary,
      drift: result.driftAnalysis.totals,
      claimCount: result.claimAnalysis.claims.length,
      verifiedCount: result.claimAnalysis.summary.verified,
      unverifiedCount: result.claimAnalysis.summary.unverified,
      alertCount: result.driftAnalysis.alerts.length
    });
  } catch (e) {
    console.error('import error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// List runs
app.get('/api/runs', async (_req, res) => {
  try {
    const runs = await listRuns();
    res.json(runs);
  } catch (e) {
    console.error('list runs error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Get full run
app.get('/api/runs/:id', async (req, res) => {
  try {
    const run = await getRun(Number(req.params.id));
    if (!run) return res.status(404).json({ error: 'run not found' });
    res.json(run);
  } catch (e) {
    console.error('get run error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Compare two runs
app.get('/api/compare/:id1/:id2', async (req, res) => {
  try {
    const comparison = compareRuns(Number(req.params.id1), Number(req.params.id2));
    res.json(comparison);
  } catch (e) {
    console.error('compare error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Delete a run
app.delete('/api/runs/:id', async (req, res) => {
  try {
    const result = await deleteRun(Number(req.params.id));
    res.json(result);
  } catch (e) {
    console.error('delete run error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`AgentWise Studio running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser.`);
});

module.exports = app;
