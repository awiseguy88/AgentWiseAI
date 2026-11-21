import crypto from 'node:crypto';
import { run as dbRun } from './db.js';

export function verifySignature(rawBody, signature, secret) {
  if (!secret) return true; // dev mode: no secret configured
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function handlePullRequest(payload) {
  const pr = payload.pull_request || {};
  const repo = payload.repository?.full_name || '';
  const prNumber = pr.number;
  const action = payload.action;
  if (action === 'closed' && pr.merged === true && repo && prNumber) {
    await dbRun(
      `UPDATE runs SET merged = 1, accepted = 1, merged_at = CURRENT_TIMESTAMP WHERE repo = $1 AND pr_number = $2`,
      [repo, prNumber],
    );
    return { handled: true, event: 'pull_request_merged', repo, pr_number: prNumber };
  }
  if (action === 'closed' && !pr.merged && repo && prNumber) {
    return { handled: true, event: 'pull_request_closed_unmerged', repo, pr_number: prNumber };
  }
  return { handled: false, event: 'pull_request_' + action };
}

export async function handleCheckRun(payload) {
  const runObj = payload.check_run || {};
  const conclusion = runObj.conclusion;
  const repo = payload.repository?.full_name || '';
  let taskId = runObj.external_id ? String(runObj.external_id) : null;
  if (!taskId && runObj.details_url) {
    try {
      const u = new URL(runObj.details_url);
      taskId = u.searchParams.get('task_id') || null;
    } catch {
      // ignore
    }
  }
  if (conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out') {
    if (taskId) {
      await dbRun(
        `UPDATE runs SET failed = 1, failed_at = CURRENT_TIMESTAMP WHERE task_id = $1`,
        [taskId],
      );
    }
    return { handled: true, event: 'check_run_failed', task_id: taskId, repo };
  }
  if (conclusion === 'success') {
    return { handled: true, event: 'check_run_success', task_id: taskId, repo };
  }
  return { handled: false, event: 'check_run_' + (conclusion || 'unknown') };
}

export async function handleWebhook(eventName, payload) {
  if (eventName === 'pull_request') return handlePullRequest(payload);
  if (eventName === 'check_run') return handleCheckRun(payload);
  if (eventName === 'push') return { handled: false, event: 'push_ignored' };
  return { handled: false, event: eventName };
}
