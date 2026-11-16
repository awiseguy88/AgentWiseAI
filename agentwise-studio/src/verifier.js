'use strict';

const CLAIM_PATTERNS = [
  { re: /\b(all\s+)?tests?\s+(are\s+)?(pass(ed|ing)?|green|succeed(ed)?|succeeded)\b/i, type: 'tests_pass' },
  { re: /\bbuild\s+(pass(ed|ing)?|succeed(ed|s)?|successful(ly)?|completed?)\b/i, type: 'build_succeeded' },
  { re: /\b(successfully\s+)?(built|compiled)\b/i, type: 'built' },
  { re: /\b(fix(ed)?|resolved|implemented|completed|done|finished|working now|should work now)\b/i, type: 'done' }
];

function analyze(events) {
  const claims = [];
  const commands = events.map((e, i) => ({ ...e, i })).filter(e => e.kind === 'command');
  const results = events.map((e, i) => ({ ...e, i })).filter(e => e.kind === 'result');
  const assistants = events.map((e, i) => ({ ...e, i })).filter(e => e.kind === 'assistant' && e.text);

  for (const a of assistants) {
    const detected = detectClaims(a.text);
    for (const claim of detected) {
      claims.push({ turnIndex: a.index, role: a.role, claimText: claim.text, claimType: claim.type, excerpt: excerptAround(a.text, claim.matchIndex), ...evaluateClaim(claim, a, events, commands, results) });
    }
  }
  return { claims, summary: summarize(claims) };
}

function detectClaims(text) {
  const found = [];
  const statements = splitStatements(text);
  for (const s of statements) {
    for (const p of CLAIM_PATTERNS) {
      const m = s.text.match(p.re);
      if (m) { found.push({ text: s.text.trim(), type: p.type, matchIndex: s.offset + m.index }); break; }
    }
  }
  if (found.length === 0) {
    for (const p of CLAIM_PATTERNS) {
      const m = text.match(p.re);
      if (m) { found.push({ text: text.trim().slice(0, 240), type: p.type, matchIndex: m.index }); break; }
    }
  }
  return dedupeClaims(found);
}

function splitStatements(text) {
  const parts = [];
  const re = /[^.!?\n]+[.!?\n]?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[0].trim();
    if (t) parts.push({ text: t, offset: m.index });
  }
  if (parts.length === 0 && text.trim()) parts.push({ text: text.trim(), offset: 0 });
  return parts;
}

function dedupeClaims(list) {
  const seen = new Set();
  return list.filter(c => { const k = c.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

function excerptAround(text, idx) {
  const i = Math.max(0, (idx || 0) - 30);
  const j = Math.min(text.length, (idx || 0) + 140);
  const e = text.slice(i, j).replace(/\s+/g, ' ').trim();
  return (i > 0 ? '…' : '') + e + (j < text.length ? '…' : '');
}

function evaluateClaim(claim, assistantEvent, events, commands, results) {
  const idx = assistantEvent.index;
  const windowStart = Math.max(0, idx - 16);
  const windowEvents = events.filter(e => e.index >= windowStart && e.index <= idx).map(e => ({ ...e, i: e.index }));
  const nearbyCommands = commands.filter(c => c.i >= windowStart && c.i < idx);
  const nearbyResults = results.filter(r => r.i >= windowStart && r.i < idx);
  const reasons = [];
  let status = 'unverified';

  const relevant = relevantResultsForClaim(claim, nearbyCommands, nearbyResults, windowEvents);
  const hasAnyResult = nearbyResults.length > 0;
  const hasRelevantResult = relevant.length > 0;

  if (!hasAnyResult && nearbyCommands.length === 0) {
    reasons.push('no_command_result: no command execution/result found near this claim');
  } else if (!hasRelevantResult) {
    reasons.push('no_matching_command_result: no result clearly matching the claimed check was found nearby');
    if (!hasAnyResult) reasons.push('no_command_result: commands were issued but no exit/result evidence was captured');
  }

  const failing = relevant.filter(r => r.exitCode !== undefined && r.exitCode !== 0);
  const passing = relevant.filter(r => r.exitCode === 0);
  const lastRelevant = relevant[relevant.length - 1];

  if (failing.length > 0) {
    const lastFail = failing[failing.length - 1];
    const passAfter = passing.find(p => p.i > lastFail.i);
    if (!passAfter) reasons.push(`failing_exit_before_claim: a relevant command failed (exit ${lastFail.exitCode}) without a later passing result before the claim`);
  }
  if (passing.length > 0 && failing.length > 0) {
    const lastPass = passing[passing.length - 1];
    const lastFail = failing[failing.length - 1];
    if (lastPass.i < lastFail.i) reasons.push('stale_green: an earlier passing result was followed by a later failing result before the claim');
  }

  if (claim.type === 'build_succeeded' || claim.type === 'built') {
    const buildCmd = nearbyCommands.some(c => /\b(build|compile|tsc|webpack|vite build|rollup|make\b|gradle|mvn|cargo build|go build|npm run build|pnpm build|yarn build)\b/i.test(c.command || ''));
    const passingBuildRes = relevant.some(r => r.exitCode === 0 && (/\b(build|compile|tsc|webpack|vite|rollup|gradle|mvn|cargo build|go build)\b/i.test(r.command || '') || /\b(build|compiled|bundled)\b/i.test(r.output || '')));
    if (!passingBuildRes) {
      const detail = buildCmd ? 'build command(s) were attempted but no passing rebuild result was captured before the claim' : 'no nearby rebuild/build command or passing build result was found';
      reasons.push(`no_rebuild: build success claimed without fresh passing rebuild evidence (${detail})`);
    }
  }

  const blocking = reasons.some(r => /failing_exit_before_claim|stale_green|no_rebuild|no_command_result|no_matching_command_result/.test(r));
  if (!blocking && hasRelevantResult && lastRelevant && lastRelevant.exitCode === 0) {
    status = 'verified';
    reasons.push(`verified_by_exit_0: matched nearby command result exited 0${lastRelevant.command ? ` (${shortCmd(lastRelevant.command)})` : ''}`);
  } else if (!blocking && hasRelevantResult && lastRelevant && lastRelevant.exitCode === undefined) {
    reasons.push('unverified_result: matching command output found but exit status was not explicit');
  }

  return {
    status,
    reasons,
    evidence: {
      matchedCommand: lastRelevant ? (lastRelevant.command || null) : null,
      matchedExitCode: lastRelevant ? (lastRelevant.exitCode !== undefined ? lastRelevant.exitCode : null) : null,
      nearbyCommandCount: nearbyCommands.length,
      nearbyResultCount: nearbyResults.length
    }
  };
}

function relevantResultsForClaim(claim, nearbyCommands, nearbyResults, windowEvents) {
  const keywords = claimKeywords(claim);
  if (keywords.length === 0) return [];
  const enriched = nearbyResults.map(r => ({ ...r, command: r.command || findCommandBefore(r, windowEvents) || '' }));
  return enriched.filter(r => {
    const hay = `${r.command} ${r.output || ''}`.toLowerCase();
    return keywords.some(k => hay.includes(k));
  });
}

function findCommandBefore(resultEvent, windowEvents) {
  const ordered = [...windowEvents].sort((a,b)=>a.i-b.i);
  for (let k = ordered.length - 1; k >= 0; k--) {
    const e = ordered[k];
    if (e.i >= resultEvent.i) continue;
    if (e.kind === 'command') return e.command || '';
    if (e.kind === 'result') break;
  }
  return '';
}

function claimKeywords(claim) {
  if (claim.type === 'tests_pass') return ['test', 'pytest', 'jest', 'mocha', 'npm test', 'pnpm test', 'yarn test', 'go test', 'cargo test', 'vitest', 'unittest'];
  if (claim.type === 'build_succeeded' || claim.type === 'built') return ['build', 'compile', 'tsc', 'webpack', 'vite', 'rollup', 'make', 'gradle', 'mvn', 'cargo', 'go build', 'bundle'];
  return [];
}

function shortCmd(cmd) {
  const s = String(cmd).replace(/\s+/g, ' ').trim();
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

function summarize(claims) {
  const total = claims.length;
  const verified = claims.filter(c => c.status === 'verified').length;
  const unverified = total - verified;
  const byReason = {};
  for (const c of claims) for (const r of c.reasons) { const key = r.split(':')[0]; byReason[key] = (byReason[key] || 0) + 1; }
  return { total, verified, unverified, byReason };
}

module.exports = { analyze, detectClaims, CLAIM_PATTERNS };
