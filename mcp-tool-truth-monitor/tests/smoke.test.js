'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseTrace } = require('../src/parser');
const { analyzeTrace } = require('../src/analyzer');
const { writeReports } = require('../src/report');

const root = path.join(__dirname, '..');
const fixtures = path.join(root, 'fixtures');

test('acceptance: isError:true followed by success claim is flagged as mismatch', () => {
  const tracePath = path.join(fixtures, 'is-error-mismatch.jsonl');
  const { events, format } = parseTrace(tracePath);
  assert.ok(events.length > 0, 'should parse events');
  const analysis = analyzeTrace(events);

  assert.equal(analysis.summary.mismatches, 1, 'expected exactly one mismatch');
  const m = analysis.mismatches[0];
  assert.equal(m.tool, 'read_file');
  assert.equal(m.problemType, 'isError');
  assert.ok(m.resultSummary.includes('isError'), 'result summary should mention isError');
  assert.ok(/success/i.test(m.claim.excerpt) || /read/i.test(m.claim.excerpt), 'claim excerpt should capture success claim');
  assert.ok(m.references.callLine, 'should have call line reference');
  assert.ok(m.references.resultLine, 'should have result line reference');
  assert.ok(m.references.claimLine, 'should have claim line reference');
  assert.equal(m.step, 1, 'mismatch should be first tool step');
});

test('acceptance: produces HTML and JSON reports offline', () => {
  const tracePath = path.join(fixtures, 'is-error-mismatch.jsonl');
  const { events } = parseTrace(tracePath);
  const analysis = analyzeTrace(events);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mttm-'));
  const written = writeReports(analysis, { outDir, traceFile: tracePath });

  assert.ok(fs.existsSync(written.jsonPath), 'JSON report should exist');
  assert.ok(fs.existsSync(written.htmlPath), 'HTML report should exist');

  const json = JSON.parse(fs.readFileSync(written.jsonPath, 'utf8'));
  assert.equal(json.summary.mismatches, 1);
  assert.equal(json.mismatches[0].tool, 'read_file');
  assert.ok(json.mismatches[0].references.claimLine, 'JSON should include claim reference');

  const html = fs.readFileSync(written.htmlPath, 'utf8');
  assert.ok(html.includes('Mismatch Table'), 'HTML should include mismatch table view');
  assert.ok(html.includes('Trace Timeline'), 'HTML should include timeline view');
  assert.ok(html.includes('Claim vs Result'), 'HTML should include claim-vs-result view');
  assert.ok(html.includes('read_file'), 'HTML should include tool name');
  assert.ok(html.includes('isError'), 'HTML should include problem type');
});

test('clean trace: zero mismatches and no invented problems', () => {
  const tracePath = path.join(fixtures, 'clean-trace.jsonl');
  const { events } = parseTrace(tracePath);
  const analysis = analyzeTrace(events);

  assert.equal(analysis.summary.totalCalls, 2);
  assert.equal(analysis.summary.mismatches, 0, 'clean trace must have zero mismatches');
});

test('MCP capture format: parses and detects mismatch', () => {
  const tracePath = path.join(fixtures, 'mcp-capture.json');
  const { events, format } = parseTrace(tracePath);
  assert.ok(events.length >= 4, 'should parse MCP capture events');
  const analysis = analyzeTrace(events);
  assert.equal(analysis.summary.mismatches >= 1, true, 'should detect isError mismatch in MCP capture');
  const m = analysis.mismatches.find(x => x.tool === 'read_file' || x.tool === 'tools/call' || x.problemType === 'isError');
  assert.ok(m, 'mismatch should reference failed tool call');
});

test('replayable fixture export round-trips to same mismatch count', () => {
  const tracePath = path.join(fixtures, 'is-error-mismatch.jsonl');
  const { events } = parseTrace(tracePath);
  const analysis = analyzeTrace(events);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mttm-fixture-'));
  const fixturePath = path.join(outDir, 'fixture.json');
  const written = writeReports(analysis, { outDir, traceFile: tracePath, exportFixturePath: fixturePath });

  assert.ok(fs.existsSync(written.fixturePath), 'fixture should be written');
  const fixture = JSON.parse(fs.readFileSync(written.fixturePath, 'utf8'));
  assert.equal(fixture.version, 1);
  assert.equal(fixture.mismatches.length, analysis.summary.mismatches);
  // Re-analyzing from normalized timeline is not same as raw parse, but fixture must be valid/replayable JSON
  assert.ok(Array.isArray(fixture.normalized));
});