'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_POLICY = {
  version: 1,
  roles: {
    executor: {
      deny: ['impersonate-user', 'external-post'],
      allow: ['read']
    },
    reviewer: {
      deny: ['write', 'impersonate-user', 'external-post'],
      allow: ['read']
    },
    planner: {
      deny: ['impersonate-user', 'external-post'],
      allow: ['read', 'write']
    }
  }
};

function loadPolicy(scanRoot, policyPathOpt) {
  const candidates = [];
  if (policyPathOpt) candidates.push(path.resolve(policyPathOpt));
  candidates.push(path.join(scanRoot, 'agent-cap-audit-policy.json'));
  candidates.push(path.join(scanRoot, '.agent-cap-audit-policy.json'));
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(raw);
        return { policy: data, path: p, source: 'file' };
      } catch (e) {
        throw new Error(`Failed to parse policy file ${p}: ${e.message}`);
      }
    }
  }
  return { policy: DEFAULT_POLICY, path: null, source: 'default' };
}

function evaluate(capabilities, policy, role) {
  const roles = (policy && policy.roles) || {};
  const rolePolicy = roles[role] || { deny: [], allow: [] };
  const deny = new Set(rolePolicy.deny || []);
  const allow = new Set(rolePolicy.allow || []);
  const violations = [];
  const passed = [];

  for (const cap of capabilities) {
    const risks = cap.risks || [];
    const deniedRisks = risks.filter(r => deny.has(r));
    const unallowedRisks = risks.filter(r => !deny.has(r) && allow.size > 0 && !allow.has(r));
    if (deniedRisks.length > 0 || unallowedRisks.length > 0) {
      violations.push({
        ...cap,
        role,
        deniedRisks,
        unallowedRisks,
        violation: deniedRisks.length > 0 ? 'denied' : 'not-allowed',
      });
    } else {
      passed.push({ ...cap, role });
    }
  }

  return { role, rolePolicy, violations, passed };
}

module.exports = { DEFAULT_POLICY, loadPolicy, evaluate };
