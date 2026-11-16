'use strict';

const path = require('path');
const { readTranscript } = require('./parser');
const { analyze: analyzeClaims } = require('./verifier');
const { analyze: analyzeDrift } = require('./drift');
const { saveRun } = require('./db');

function normalizeName(sourcePath) {
  const base = path.basename(sourcePath);
  return base || 'unnamed run';
}

// Build step-like objects from transcript events so drift analysis has
// signatures/durations/tokens to work with.
function eventsToSteps(events) {
  return events.map((e, i) => {
    const name = e.kind === 'command' ? (e.command || 'command') : (e.kind === 'assistant' ? 'assistant' : (e.kind === 'result' ? 'result' : 'event'));
    const signature = `${e.kind}|${(e.command || e.text || '').replace(/\s+/g, ' ').slice(0, 200)}`;
    return {
      index: i,
      name: String(name).slice(0, 120),
      type: e.kind || 'step',
      span: null,
      duration_ms: null,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      quality: null,
      input_preview: (e.command || e.text || '').slice(0, 300),
      output_preview: (e.output || '').slice(0, 300),
      signature,
      output_signature: `${e.kind}|${(e.output || '').replace(/\s+/g, ' ').slice(0, 200)}`
    };
  });
}

function buildSummary(claimAnalysis, driftAnalysis) {
  return {
    claims: claimAnalysis.summary,
    drift: driftAnalysis.totals,
    alertCount: driftAnalysis.alerts.length,
    generatedAt: new Date().toISOString()
  };
}

function importTranscript(filePath) {
  const { events, format, source } = readTranscript(filePath);
  const claimAnalysis = analyzeClaims(events);
  const steps = eventsToSteps(events);
  const driftAnalysis = analyzeDrift(steps, { maxStepMs: 5000, maxStepTokens: 2000, loopRepeat: 3 });

  const runData = {
    name: normalizeName(source),
    sourcePath: source,
    transcriptFormat: format,
    summary: buildSummary(claimAnalysis, driftAnalysis),
    claims: claimAnalysis.claims.map(c => ({
      turnIndex: c.turnIndex,
      claimText: c.claimText,
      claimType: c.claimType,
      status: c.status,
      reasons: c.reasons,
      evidence: c.evidence
    })),
    driftAlerts: driftAnalysis.alerts.map(a => ({
      type: a.type,
      severity: a.severity,
      steps: a.steps,
      message: a.message,
      metric: a.metric
    })),
    driftSteps: steps.map(s => ({
      index: s.index,
      name: s.name,
      type: s.type,
      span: s.span,
      duration_ms: s.duration_ms,
      prompt_tokens: s.prompt_tokens,
      completion_tokens: s.completion_tokens,
      total_tokens: s.total_tokens,
      quality: s.quality,
      input_preview: s.input_preview,
      output_preview: s.output_preview,
      signature: s.signature,
      output_signature: s.output_signature
    }))
  };

  const saved = saveRun(runData);
  return { ...saved, claimAnalysis, driftAnalysis };
}

module.exports = { importTranscript, analyzeClaims, analyzeDrift, eventsToSteps };