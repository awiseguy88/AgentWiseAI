'use strict';

const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');

const DEFINITIONS = [
  { file: 'hooks/claude-code.md', name: 'Claude Code', description: 'Starter guardrail snippet for Claude Code-style local workflows: require fresh passing check output before accepting completion claims.' },
  { file: 'hooks/codex-cli.md', name: 'Codex CLI', description: 'Starter policy snippet for Codex CLI sessions: verify command exit codes and rebuild evidence before marking work done.' },
  { file: 'hooks/aider.md', name: 'Aider', description: 'Starter workflow snippet for Aider: run lint/test/build commands and attach results before a completion summary.' },
  { file: 'hooks/generic.md', name: 'Generic agent CLI', description: 'Portable prompt/policy snippet for local coding agents to prevent stale-green and unbacked “done” claims.' }
];

function loadSnippets() {
  return DEFINITIONS.map(d => {
    const abs = path.join(__dirname, '..', d.file);
    let content = '';
    try { content = fs.readFileSync(abs, 'utf8'); } catch {}
    return { ...d, content };
  });
}

module.exports = { loadSnippets, HOOKS_DIR };
