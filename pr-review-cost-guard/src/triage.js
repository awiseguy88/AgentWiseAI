'use strict';

// --- triage.js: cheap local first-pass classifier ---
// Zero-cost local heuristic that decides which hunks should go to a pricier
// model for review. Over-flagging is safe (costs more estimate); under-flagging
// is the risk, so security/infra/deps/large hunks are flagged generously.

const SECURITY = /(password|passwd|secret|api.?key|access.?token|credential|oauth|private.?key|ssh.?key|sudo|chmod|chown|eval\(|exec\(|child_process|spawn|crypt|decrypt|encrypt|jwt|bearer)/i;
const INFRA_CONFIG = /\.(ya?ml|toml|ini|cfg|conf|env|tf|tfvars|dockerfile|dockerignore|gitignore)$/i;
const INFRA_PATH = /(\.github\/|dockerfile|docker-compose|kubernetes|k8s|helm\/|terraform|cloudformation|ci\/|\.circleci|travis|\.gitlab-ci)/i;
const DEPS = /(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|go\.mod|go\.sum|requirements\.txt|poetry\.lock|cargo\.toml|cargo\.lock|mix\.exs|Gemfile\.lock)/i;

function hunkText(hunk) {
  return (hunk.lines || []).map((l) => l.content).join('\n');
}

function triageHunk(hunk, filePath, largeHunkLines) {
  const reasons = [];
  const text = hunkText(hunk);
  const allText = (filePath || '') + '\n' + text;

  const lineCount = (hunk.lines || []).length;
  if (lineCount >= largeHunkLines) reasons.push('large_hunk');
  if (SECURITY.test(allText)) reasons.push('security_sensitive');
  if (INFRA_PATH.test(allText) || INFRA_CONFIG.test(allText)) reasons.push('config_or_infra');
  if (DEPS.test(allText)) reasons.push('dependency_change');

  return { flagged: reasons.length > 0, reasons };
}

function triageFile(file, largeHunkLines) {
  const hunks = (file.hunks || []).map((h) => Object.assign({}, h, {
    triage: triageHunk(h, file.path, largeHunkLines),
  }));
  const flagged = hunks.filter((h) => h.triage.flagged).length;
  return { path: file.path, hunks, flaggedHunks: flagged };
}

function triageDiff(parsed, largeHunkLines) {
  const files = (parsed.files || []).map((f) => triageFile(f, largeHunkLines));
  const totalHunks = files.reduce((s, f) => s + f.hunks.length, 0);
  const flaggedHunks = files.reduce((s, f) => s + f.flaggedHunks, 0);
  return { files, totalHunks, flaggedHunks };
}

module.exports = { triageHunk, triageFile, triageDiff };
