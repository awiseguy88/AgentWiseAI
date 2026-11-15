/**
 * Solo Site Rescue Kit — local git helper.
 *
 * Initializes a git repository in the output directory (if needed) and commits the
 * rescued site. Uses the author identity configured by the runtime or passed via
 * options; no global git config is relied upon.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fsp from "node:fs/promises";

const execFileAsync = promisify(execFile);

async function runGit(args, cwd, env = {}) {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd,
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: stdout?.toString() || "", stderr: stderr?.toString() || "" };
}

async function isGitRepo(dir) {
  try {
    await fsp.access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize (if needed) and commit the output directory.
 * options: { authorName, authorEmail, message }
 * Returns { committed, hash, branch, initialized } or { committed: false, reason }.
 */
export async function commitOutput(outDir, options = {}) {
  const authorName =
    options.authorName ||
    process.env.DSH_SUPERAGENT_GITHUB_ACCOUNT ||
    "Solo Site Rescue Kit";
  const authorEmail =
    options.authorEmail ||
    process.env.DSH_SUPERAGENT_GITHUB_COMMIT_EMAIL ||
    `${authorName}@users.noreply.github.com`;
  const message = options.message || "chore: add rescued site output (solo-site-rescue-kit)";

  let initialized = false;
  if (!(await isGitRepo(outDir))) {
    await runGit(["init"], outDir);
    initialized = true;
  }

  await runGit(["add", "-A"], outDir);

  // Check if there is anything to commit.
  try {
    const { stdout } = await runGit(["status", "--porcelain"], outDir);
    if (!stdout.trim()) {
      return { committed: false, reason: "nothing to commit", initialized, hash: null };
    }
  } catch (err) {
    return { committed: false, reason: err.message, initialized, hash: null };
  }

  const env = {
    GIT_AUTHOR_NAME: authorName,
    GIT_AUTHOR_EMAIL: authorEmail,
    GIT_COMMITTER_NAME: authorName,
    GIT_COMMITTER_EMAIL: authorEmail,
  };

  try {
    await runGit(["commit", "-m", message], outDir, env);
    const { stdout } = await runGit(["rev-parse", "HEAD"], outDir);
    const hash = stdout.trim();
    let branch = null;
    try {
      const { stdout: b } = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], outDir);
      branch = b.trim();
    } catch {
      branch = null;
    }
    return { committed: true, hash, branch, initialized, author: `${authorName} <${authorEmail}>` };
  } catch (err) {
    return { committed: false, reason: err.message, initialized, hash: null };
  }
}
