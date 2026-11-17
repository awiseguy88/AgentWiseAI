import crypto from 'node:crypto';

export function getThresholds() {
  const maxLines = Number(process.env.MAX_LINES || 500);
  const maxFiles = Number(process.env.MAX_FILES || 10);
  return { maxLines, maxFiles };
}

export function verifySignature(secret, rawBody, signature) {
  if (!secret) return { valid: false, reason: 'WEBHOOK_SECRET not configured' };
  if (!signature) return { valid: false, reason: 'missing signature' };

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody || '', 'utf8');
  const expected = `sha256=${hmac.digest('hex')}`;

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) {
    return { valid: false, reason: 'invalid signature' };
  }
  const valid = crypto.timingSafeEqual(sigBuf, expBuf);
  return valid ? { valid: true } : { valid: false, reason: 'invalid signature' };
}

export function computeSprawl(diff, thresholds) {
  const { maxLines, maxFiles } = thresholds || getThresholds();

  let additions = 0;
  let deletions = 0;
  let files = 0;

  if (Array.isArray(diff)) {
    // Array of file changes, each with additions/deletions
    files = diff.length;
    for (const f of diff) {
      additions += Number(f.additions || 0);
      deletions += Number(f.deletions || 0);
    }
  } else if (diff && typeof diff === 'object') {
    additions = Number(diff.additions || 0);
    deletions = Number(diff.deletions || 0);
    files = Number(diff.changed_files || diff.files || 0);
  }

  const lines = additions + deletions;
  const isSprawl = lines > maxLines || files > maxFiles;
  return { lines, files, additions, deletions, maxLines, maxFiles, isSprawl };
}

export function diffFromPayload(pr) {
  // GitHub PR payload includes additions/deletions/changed_files
  return {
    additions: Number(pr.additions || 0),
    deletions: Number(pr.deletions || 0),
    changed_files: Number(pr.changed_files || 0),
  };
}

export function fixtureDiff(fixturePr) {
  // Test fixtures embed a diff structure
  if (fixturePr.diff && Array.isArray(fixturePr.diff)) return fixturePr.diff;
  return diffFromPayload(fixturePr);
}

export async function rescopePr(repo, prNumber, title, githubToken) {
  const commentBody = `This pull request has been flagged as sprawl by the AI PR Review Governance Workbench (>${getThresholds().maxLines} lines or >${getThresholds().maxFiles} files). Please rescope this PR into smaller, reviewable chunks.\n\nAction: "send back to rescope" (needs-rescope).`;
  const label = 'needs-rescope';

  if (!githubToken) {
    // Mock mode: record action without calling GitHub
    return {
      comment: { body: commentBody, posted: false, mock: true },
      label: { name: label, applied: false, mock: true },
      mock: true,
    };
  }

  const [owner, repoName] = String(repo).split('/');
  const baseUrl = `https://api.github.com/repos/${owner}/${repoName}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  const commentRes = await fetch(`${baseUrl}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: commentBody }),
  });
  if (!commentRes.ok) {
    const text = await commentRes.text();
    throw new Error(`Failed to post comment: ${commentRes.status} ${text}`);
  }

  const labelRes = await fetch(`${baseUrl}/issues/${prNumber}/labels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ labels: [label] }),
  });
  if (!labelRes.ok) {
    const text = await labelRes.text();
    throw new Error(`Failed to add label: ${labelRes.status} ${text}`);
  }

  return {
    comment: { body: commentBody, posted: true },
    label: { name: label, applied: true },
    mock: false,
  };
}