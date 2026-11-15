'use strict';

const fs = require('fs');
const path = require('path');

function readTextSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}
function readJsonSafe(p) {
  const text = readTextSafe(p);
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function capability(name, source, detail, risks = ['read']) {
  return { name, source, detail, risks };
}

/**
 * Extract mcpServers-style capabilities from a JSON object whose value has mcpServers map.
 */
function extractMcpServers(obj, source) {
  const caps = [];
  if (!obj || typeof obj !== 'object') return caps;
  const servers = obj.mcpServers || obj.servers || obj.mcp_servers || {};
  if (servers && typeof servers === 'object') {
    for (const [name, def] of Object.entries(servers)) {
      const cmd = def && (def.command || def.cmd || def.server || def.name);
      const args = def && def.args ? ` args: ${def.args.join(' ')}` : '';
      const detail = `command: ${cmd}${args}`;
      caps.push(capability(name || 'unnamed-server', source, detail, ['read']));
    }
  }
  return caps;
}

function scanMcpConfigFile(filePath) {
  const obj = readJsonSafe(filePath);
  if (!obj) return [];
  return extractMcpServers(obj, filePath);
}

function scanPackageJsonScripts(filePath) {
  const obj = readJsonSafe(filePath);
  if (!obj || !obj.scripts || typeof obj.scripts !== 'object') return [];
  const caps = [];
  for (const [name, value] of Object.entries(obj.scripts)) {
    const scriptText = String(value || '');
    const lower = scriptText.toLowerCase();
    let matched = null;
    const connectors = ['slack', 'gmail', 'drive', 'calendar', 'contacts', 'github', 'notion', 'figma', 'linear', 'jira', 'discord'];
    for (const c of connectors) {
      if (lower.includes(c)) { matched = c; break; }
    }
    if (/mcp|agent|connector/.test(lower) && !matched) matched = 'mcp';
    if (matched) {
      caps.push(capability(`npm script "${name}"`, filePath, scriptText, matched === 'mcp' ? ['read'] : ['read', 'external-post']));
    }
  }
  return caps;
}

function scanCodexConfig(filePath) {
  const text = readTextSafe(filePath);
  if (!text) return [];
  const caps = [];
  const features = [];
  const featureKeys = ['slack', 'gmail', 'drive', 'calendar', 'contacts', 'github', 'notion', 'figma', 'linear', 'jira', 'discord'];
  for (const f of featureKeys) {
    // Match lines like "slack = true" or "slack=true" (enabled), ignore "slack = false"
    const re = new RegExp(`\\b${f}\\s*=\\s*true\\b`, 'i');
    if (re.test(text)) features.push(f);
  }
  // Also check for generic mcp/server enabling
  const mcpEnabled = /\[mcp\]\s*\n(?:[^\n]*\n)*?\s*enabled\s*=\s*true/i.test(text) ||
                     /mcp_enabled\s*=\s*true/i.test(text);
  if (mcpEnabled && features.length === 0) features.push('mcp');
  if (features.length) {
    caps.push(capability('codex config/features', filePath, `enabled features/connectors: ${features.join(', ')}`, ['read', 'external-post']));
  }
  return caps;
}

function scanCodexJson(filePath) {
  const obj = readJsonSafe(filePath);
  if (!obj) return [];
  const caps = [];
  const connectors = [];
  const keys = ['slack', 'gmail', 'drive', 'calendar', 'contacts', 'github', 'notion', 'figma', 'linear', 'jira', 'discord'];
  // Check both top-level keys and nested features/connectors objects for true values
  function checkEnabled(o) {
    if (!o || typeof o !== 'object') return;
    for (const k of keys) {
      if (o[k] === true) connectors.push(k);
    }
    for (const k of ['features', 'connectors', 'tools', 'mcp']) {
      if (o[k] && typeof o[k] === 'object') checkEnabled(o[k]);
    }
  }
  checkEnabled(obj);
  if (connectors.length) {
    caps.push(capability('codex config/json', filePath, `connectors/features present: ${connectors.join(', ')}`, ['read', 'external-post']));
  }
  return caps;
}

function scanForMcpJsonFiles(scanRoot) {
  const caps = [];
  try {
    const entries = fs.readdirSync(scanRoot, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(scanRoot, e.name);
      if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') {
        caps.push(...scanForMcpJsonFiles(full));
      } else if (e.name === 'mcp.json') {
        caps.push(...scanMcpConfigFile(full));
      } else if (e.name === 'package.json') {
        caps.push(...scanPackageJsonScripts(full));
      } else if (e.name === 'codex.json' || e.name === 'codex.features.json') {
        caps.push(...scanCodexJson(full));
      }
    }
  } catch (e) {
    // ignore unreadable dirs
  }
  return caps;
}

function findKnownHomeConfigLookalikes(scanRoot) {
  // Scan root is typically a project dir; home configs live outside. We look for
  // lookalike files inside the scan root only so results stay local/offline.
  const caps = [];
  const codexConfig = path.join(scanRoot, '.codex', 'config.toml');
  const codexFeatures = path.join(scanRoot, '.codex', 'features.toml');
  const claudeMcp = path.join(scanRoot, '.claude', 'mcp.json');
  const claudeCodeMcp = path.join(scanRoot, '.claude', 'claude_code_mcp.json');
  const cursorMcp = path.join(scanRoot, '.cursor', 'mcp.json');
  for (const p of [codexConfig, codexFeatures]) {
    if (readTextSafe(p)) caps.push(...scanCodexConfig(p));
  }
  for (const p of [claudeMcp, claudeCodeMcp, cursorMcp]) {
    caps.push(...scanMcpConfigFile(p));
  }
  return caps;
}

function scanConfigs(scanRoot) {
  const caps = [];
  caps.push(...scanForMcpJsonFiles(scanRoot));
  caps.push(...findKnownHomeConfigLookalikes(scanRoot));
  return caps;
}

module.exports = { scanConfigs, scanMcpConfigFile, scanPackageJsonScripts, scanCodexConfig, scanCodexJson };
