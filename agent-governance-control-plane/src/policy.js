import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let policy = null;

export function loadPolicy(configPath) {
  const path = configPath || process.env.CONFIG_PATH || join(__dirname, '..', 'config', 'policy.json');
  policy = JSON.parse(readFileSync(path, 'utf8'));
  return policy;
}

export function getPolicy() {
  if (!policy) loadPolicy();
  return policy;
}

function toolKey(tool) {
  return (tool || '').toUpperCase();
}

function inferRisk(tool, args) {
  const t = toolKey(tool);
  if (t === 'DELETE' || t === 'DROP') return 'delete';
  if (t === 'INSERT' || t === 'UPDATE' || t === 'WRITE') return 'write';
  if (t === 'SELECT' || t === 'READ' || t === 'QUERY') return 'read';
  // args hint
  const q = (args && (args.query || args.sql || '')).toUpperCase();
  if (/^\s*DELETE\b/.test(q)) return 'delete';
  if (/^\s*(INSERT|UPDATE)\b/.test(q)) return 'write';
  return 'read';
}

export function evaluateToolCall(tool, args) {
  const pol = getPolicy();
  const t = toolKey(tool);
  const rule = (pol.rules || []).find(r => toolKey(r.tool) === t);
  const riskClass = rule?.riskClass || inferRisk(tool, args);
  if (rule) {
    return {
      tool: t,
      riskClass,
      decision: rule.decision,
      reason: rule.reason || `Policy: ${rule.decision}`,
      rule,
    };
  }
  // fallback by risk class
  const classRule = (pol.rules || []).find(r => r.riskClass === riskClass && !r.tool);
  if (classRule) {
    return { tool: t, riskClass, decision: classRule.decision, reason: classRule.reason || `Policy: ${classRule.decision}` };
  }
  return { tool: t, riskClass, decision: pol.defaultDecision || 'block', reason: 'Default policy denies unmatched tool' };
}
