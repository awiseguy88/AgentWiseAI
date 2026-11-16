'use strict';

const { SUCCESS_CLAIM_PATTERNS, _extractText } = require('./parser');

const PROBLEM_TYPES = new Set(['isError', 'empty', 'timeout', 'error']);

function _textOf(ev) {
  if (ev.text !== undefined) return ev.text;
  if (ev.content !== undefined) return _extractText(ev.content);
  return '';
}

function _contentText(ev) {
  return _textOf(ev) || '';
}

/**
 * Normalize result shape so analyzer works for both JSONL and MCP captures.
 */
function _getResult(ev) {
  return ev.result !== undefined ? ev.result : ev;
}

/**
 * Pair tool calls with results by tool_call_id (when present), falling back
 * to nearest preceding unmatched tool_call of the same tool name.
 */
function _pairCallsAndResults(events) {
  const calls = events.filter((e) => e.kind === 'tool_call');
  const results = events.filter((e) => e.kind === 'tool_result');
  const resultUsed = new Array(results.length).fill(false);
  const pairs = [];

  // Primary: match by call id.
  for (const result of results) {
    const id = result.toolCallId || result.id;
    let matchIdx = -1;
    if (id !== undefined) {
      matchIdx = calls.findIndex(
        (c, i) => !c._paired && (c.toolCallId || c.id) === id
      );
    }
    if (matchIdx === -1) {
      // Fallback: nearest preceding unmatched call with same tool name.
      const name = result.toolName;
      const candidates = calls.filter((c, i) => !c._paired && c.toolName === name);
      if (candidates.length) {
        candidates.sort((a, b) => (a.line || 0) - (b.line || 0));
        matchIdx = calls.indexOf(candidates[candidates.length - 1]);
      }
    }
    if (matchIdx !== -1) {
      calls[matchIdx]._paired = true;
      pairs.push({ call: calls[matchIdx], result });
    }
  }

  // Unpaired calls with no result -> timeout-style missing result.
  for (const call of calls) {
    if (call._paired) continue;
    pairs.push({ call, result: null });
    call._paired = true;
  }

  pairs.sort((a, b) => (a.call.line || 0) - (b.call.line || 0));
  return pairs;
}

function _classifyProblem(call, result) {
  const classified = result && result.classified
    ? result.classified
    : _classifyResultShape(result);
  const problemType = classified.type;
  if (problemType === 'ok') return null;

  return {
    type: problemType,
    summary: classified.summary || problemType,
  };
}

function _classifyResultShape(result) {
  if (result == null) return { type: 'empty', summary: 'no result captured (possible timeout)' };
  const isError = result.isError === true || result.error !== undefined;
  const content = result.content;
  const text = _extractText(content);
  if (isError) {
    return { type: 'isError', summary: 'isError: true — tool reported an error' };
  }
  if (text === '' && (!Array.isArray(content) || content.length === 0)) {
    return { type: 'empty', summary: 'empty result (no content)' };
  }
  const str = JSON.stringify(result);
  if (/timeout|timed.?out|abort|cancel/i.test(str)) {
    return { type: 'timeout', summary: 'timeout / no response captured' };
  }
  return { type: 'ok', summary: 'ok' };
}

/**
 * Detect success/claim language in assistant messages occurring after a call.
 * Returns array of { index, excerpt, type, line } for each claim.
 */
function _detectClaims(events, afterIndex) {
  const claims = [];
  for (let i = afterIndex + 1; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind !== 'message') continue;
    const text = _contentText(ev);
    if (!text.trim()) continue;
    for (const re of SUCCESS_CLAIM_PATTERNS) {
      const m = text.match(re);
      if (m) {
        claims.push({
          index: i,
          line: ev.line,
          type: _claimType(m[0]),
          excerpt: _excerpt(text, m.index),
          role: ev.role || 'assistant',
        });
        break; // one claim per message
      }
    }
  }
  return claims;
}

function _claimType(matched) {
  const l = matched.toLowerCase();
  if (/build|compile|bundle/.test(l)) return 'build';
  if (/test/.test(l)) return 'test';
  if (/done|fixed|resolved|completed|finished/.test(l)) return 'done';
  return 'success';
}

function _excerpt(text, idx) {
  const i = Math.max(0, (idx || 0) - 40);
  const j = Math.min(text.length, (idx || 0) + 120);
  const e = text.slice(i, j).replace(/\s+/g, ' ').trim();
  return (i > 0 ? '…' : '') + e + (j < text.length ? '…' : '');
}

function _matchedCallName(result) {
  return result && (result.toolName || result.tool_name || result.name);
}

/**
 * Analyze a normalized trace: pair calls/results, classify problems, match
 * subsequent agent claims, flag mismatches.
 */
function analyzeTrace(events) {
  const pairs = _pairCallsAndResults(events);

  const mismatches = [];
  const cleanMatches = [];
  const timeline = [];
  const claimEvents = events.filter((e) => e.kind === 'message');

  let step = 0;
  for (const pair of pairs) {
    step++;
    const { call, result } = pair;
    const problem = result ? _classifyProblem(call, result) : null;
    const callName = _matchedCallName(call) || (call && call.toolName) || 'unknown';
    const callLine = call && call.line;
    const resultLine = result && result.line;

    // Claims after this call. Scan messages after the call (not strictly
    // bounded by the next tool_call, since assistant claims in capture-style
    // traces may appear after several calls).
    const startIndex = events.findIndex((e) => e === call);
    const claims = _detectClaims(events, startIndex === -1 ? 0 : startIndex);

    const entry = {
      step,
      callId: call && (call.toolCallId || call.id),
      tool: callName,
      callLine,
      resultLine,
      callArgs: call && call.args,
      result: result ? _getResult(result) : null,
      problem,
      claims,
      classified: problem ? problem.type : 'ok',
    };
    timeline.push(entry);

    if (problem && PROBLEM_TYPES.has(problem.type)) {
      const relatedClaim = claims.length ? claims[0] : null;
      if (relatedClaim) {
        mismatches.push({
          step,
          tool: callName,
          callId: entry.callId,
          callLine,
          resultLine,
          claimLine: relatedClaim.line,
          claimIndex: relatedClaim.index,
          problemType: problem.type,
          resultSummary: problem.summary,
          claim: {
            excerpt: relatedClaim.excerpt,
            type: relatedClaim.type,
            role: relatedClaim.role,
            line: relatedClaim.line,
          },
          references: {
            callLine,
            resultLine,
            claimLine: relatedClaim.line,
          },
          callArgs: call && call.args,
          result: result ? (result.result !== undefined ? result.result : result) : null,
        });
      } else {
        // Problematic result with no later claim: still noteworthy but not a
        // claim-vs-result mismatch (agent made no success claim to contradict).
        cleanMatches.push({
          step,
          tool: callName,
          callId: entry.callId,
          note: `${problem.summary}; no contradictory success claim found afterward`,
          classified: problem.type,
        });
      }
    } else {
      cleanMatches.push({
        step,
        tool: callName,
        callId: entry.callId,
        note: problem ? problem.summary : 'result matches claim expectation',
        classified: problem ? problem.type : 'ok',
      });
    }
  }

  return {
    totalCalls: pairs.length,
    mismatches,
    cleanMatches,
    timeline,
    summary: {
      totalCalls: pairs.length,
      mismatches: mismatches.length,
      cleanMatches: cleanMatches.length,
    },
  };
}

module.exports = {
  analyzeTrace,
  _pairCallsAndResults,
  _detectClaims,
  _classifyProblem,
};