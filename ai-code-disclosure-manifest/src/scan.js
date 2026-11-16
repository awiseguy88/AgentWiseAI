/**
 * Repository Scanner
 * Orchestrates git log scanning and file walking for AI markers
 * Zero dependencies — Node.js stdlib only
 */

const {
  getCommitHashes,
  getCommitDetails,
  getCommitFiles,
  findRepoRoot,
  walkFiles,
  readFileSafe,
  isSourceFile,
  parseDate,
} = require('./utils');
const {
  classifyCommit,
  classifyFile,
  filterByConfidence,
  summarize,
} = require('./classify');

/**
 * Scan a repository for AI markers
 * @param {string} repoPath - Path to repository (defaults to cwd)
 * @param {Object} options
 * @param {string} [options.since] - ISO date string, only scan commits after this
 * @param {string} [options.confidence] - 'high', 'medium', 'low', 'all' (default: 'all')
 * @param {boolean} [options.verbose] - Print progress
 * @returns {Promise<Object>} Scan results
 */
async function scanRepository(repoPath, options = {}) {
  const { since, confidence = 'all', verbose = false } = options;

  // Find repo root
  const root = findRepoRoot(repoPath);
  if (!root) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  if (verbose) console.error(`Scanning repository: ${root}`);

  // Get commit hashes
  const commitHashes = getCommitHashes(root, { since });
  if (verbose) console.error(`Found ${commitHashes.length} commits`);

  // Scan commits
  const commitResults = [];
  for (const hash of commitHashes) {
    const details = getCommitDetails(root, hash);
    if (!details) continue;
    const classified = classifyCommit(details);
    // Filter by confidence
    classified.findings = filterByConfidence(classified.findings, confidence);
    commitResults.push(classified);
    if (verbose && classified.findings.length) {
      console.error(`  Commit ${hash.slice(0, 7)}: ${classified.findings.length} findings`);
    }
  }

  // Scan source files
  const allFiles = walkFiles(root);
  const sourceFiles = allFiles.filter(isSourceFile);
  if (verbose) console.error(`Scanning ${sourceFiles.length} source files`);

  const fileResults = [];
  for (const filePath of sourceFiles) {
    const content = readFileSafe(filePath);
    if (!content) continue;
    const classified = classifyFile(filePath, content, root);
    classified.findings = filterByConfidence(classified.findings, confidence);
    if (classified.findings.length) {
      fileResults.push(classified);
      if (verbose) {
        console.error(`  ${classified.file}: ${classified.findings.length} findings`);
      }
    }
  }

  // Generate summary
  const summary = summarize(commitResults, fileResults);

  return {
    scanInfo: {
      repository: root,
      scannedAt: new Date().toISOString(),
      options: { since, confidence, verbose },
      commitCount: commitHashes.length,
      fileCount: sourceFiles.length,
    },
    commits: commitResults,
    files: fileResults,
    summary,
  };
}

/**
 * Quick scan - only commits, no file walk (faster)
 * @param {string} repoPath
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function quickScan(repoPath, options = {}) {
  const { since, confidence = 'all', verbose = false } = options;
  const root = findRepoRoot(repoPath);
  if (!root) throw new Error(`Not a git repository: ${repoPath}`);

  const commitHashes = getCommitHashes(root, { since });
  const commitResults = [];

  for (const hash of commitHashes) {
    const details = getCommitDetails(root, hash);
    if (!details) continue;
    const classified = classifyCommit(details);
    classified.findings = filterByConfidence(classified.findings, confidence);
    commitResults.push(classified);
  }

  const summary = summarize(commitResults, []);

  return {
    scanInfo: {
      repository: root,
      scannedAt: new Date().toISOString(),
      options: { since, confidence, verbose, mode: 'quick' },
      commitCount: commitHashes.length,
      fileCount: 0,
    },
    commits: commitResults,
    files: [],
    summary,
  };
}

module.exports = {
  scanRepository,
  quickScan,
};