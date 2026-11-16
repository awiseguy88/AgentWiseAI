/**
 * Shared utilities for AI Code Disclosure Manifest
 * Zero dependencies — Node.js stdlib only
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, readdirSync, statSync } = require('fs');
const { join, relative, extname, basename } = require('path');

/**
 * Execute git command in a repository and return stdout as string
 * @param {string} repoPath - Path to git repository
 * @param {string} args - Git command arguments
 * @returns {string} Command output (trimmed)
 */
function git(repoPath, args) {
  try {
    const output = execSync(`git ${args}`, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return output.trim();
  } catch (e) {
    // Return empty string on git errors (e.g., not a repo, no commits)
    return '';
  }
}

/**
 * Get all commit hashes in reverse chronological order (newest first)
 * @param {string} repoPath
 * @param {Object} options
 * @param {string} [options.since] - ISO date string, only commits after this
 * @returns {string[]} Array of commit hashes
 */
function getCommitHashes(repoPath, options = {}) {
  let args = 'log --pretty=format:%H --reverse';
  if (options.since) {
    args += ` --since="${options.since}"`;
  }
  const output = git(repoPath, args);
  return output ? output.split('\n').filter(Boolean) : [];
}

/**
 * Get full commit details for a hash
 * @param {string} repoPath
 * @param {string} hash
 * @returns {Object} Parsed commit info
 */
function getCommitDetails(repoPath, hash) {
  const format = '%H|%an|%ae|%ad|%s|%b';
  const args = `log -1 --pretty=format:"${format}" --date=iso-strict ${hash}`;
  const output = git(repoPath, args);
  if (!output) return null;

  const [hash_, authorName, authorEmail, date, subject, body] = output.split('|', 6);
  return {
    hash: hash_,
    author: { name: authorName, email: authorEmail },
    date,
    subject,
    body: body || '',
    rawMessage: `${subject}\n\n${body}`.trim(),
  };
}

/**
 * Get list of files changed in a commit
 * @param {string} repoPath
 * @param {string} hash
 * @returns {string[]} Relative file paths
 */
function getCommitFiles(repoPath, hash) {
  const output = git(repoPath, `diff-tree --no-commit-id --name-only -r ${hash}`);
  return output ? output.split('\n').filter(Boolean) : [];
}

/**
 * Read file content safely
 * @param {string} filePath
 * @returns {string|null} File content or null if unreadable
 */
function readFileSafe(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Check if a path is a git repository
 * @param {string} path
 * @returns {boolean}
 */
function isGitRepo(path) {
  return existsSync(join(path, '.git'));
}

/**
 * Get repository root from any subdirectory
 * @param {string} startPath
 * @returns {string|null} Absolute path to repo root or null
 */
function findRepoRoot(startPath) {
  let current = startPath;
  while (current !== '/') {
    if (isGitRepo(current)) return current;
    const parent = join(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Walk directory recursively, return all file paths
 * @param {string} dir
 * @param {Object} options
 * @param {string[]} [options.ignore] - Directory names to skip
 * @param {number} [options.maxDepth] - Maximum recursion depth
 * @returns {string[]} Absolute file paths
 */
function walkFiles(dir, options = {}) {
  const { ignore = ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'], maxDepth = 10 } = options;
  const results = [];

  function walk(currentDir, depth = 0) {
    if (depth > maxDepth) return;
    const base = basename(currentDir);
    if (ignore.includes(base)) return;

    let entries;
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (stats.isFile()) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Get file extension normalized (lowercase, with dot)
 * @param {string} filePath
 * @returns {string}
 */
function getExt(filePath) {
  return extname(filePath).toLowerCase();
}

/**
 * Check if file is likely a source/code file (not binary, not config-only)
 * @param {string} filePath
 * @returns {boolean}
 */
function isSourceFile(filePath) {
  const ext = getExt(filePath);
  const sourceExts = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
    '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
    '.cs', '.fs', '.vb',
    '.php', '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.vue', '.svelte', '.astro',
    '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.md', '.mdx', '.txt', '.rst',
    '.sh', '.bash', '.zsh', '.fish', '.ps1',
    '.sql', '.graphql', '.gql',
    '.proto', '.thrift',
    '.dockerfile', '.dockerignore',
    '.gitignore', '.gitattributes',
  ]);
  // Also check common filenames without extension
  const base = basename(filePath).toLowerCase();
  const specialNames = new Set([
    'dockerfile', 'makefile', 'rakefile', 'gemfile', 'podfile',
    'jenkinsfile', 'vagrantfile', 'berksfile', 'thorfile',
    'license', 'readme', 'changelog', 'contributing', 'authors',
  ]);
  return sourceExts.has(ext) || specialNames.has(base);
}

/**
 * Parse ISO date string to Date object, return null if invalid
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseDate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format date for display
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Escape HTML special characters
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;')
}

/**
 * Truncate string to max length
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncate(str, max = 100) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

module.exports = {
  git,
  getCommitHashes,
  getCommitDetails,
  getCommitFiles,
  readFileSafe,
  isGitRepo,
  findRepoRoot,
  walkFiles,
  getExt,
  isSourceFile,
  parseDate,
  formatDate,
  escapeHtml,
  truncate,
};