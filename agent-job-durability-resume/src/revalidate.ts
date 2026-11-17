import path from "node:path";
import { execSync } from "node:child_process";
import fs from "node:fs";
import type { Checkpoint, Step, WorkspaceValidation } from "./types.js";
import { collectFileHashes, captureGitStatus } from "./workspace.js";

export interface ValidationResult extends WorkspaceValidation {
  diff: string[];
}

/**
 * Revalidate the workspace against a stored checkpoint.
 *
 * - git status: compare current `git status --porcelain` to the checkpoint snapshot
 * - file hashes: any file the checkpoint tracked whose current hash differs (or is
 *   now missing) is flagged as externally changed
 *
 * A validation "passes" when no tracked file changed. When files change, the caller
 * (replan) decides whether to mark downstream steps stale.
 */
export function validateWorkspace(
  repoRoot: string,
  checkpoint: Checkpoint,
  steps: Step[],
): ValidationResult {
  const nowHashes = collectFileHashes(repoRoot);
  const nowMap = new Map(nowHashes.map((h) => [h.path, h.hash]));
  const cpMap = new Map(checkpoint.fileHashes.map((h) => [h.path, h.hash]));

  const diff: string[] = [];
  const allPaths = new Set<string>([...cpMap.keys(), ...nowMap.keys()]);
  for (const p of allPaths) {
    const before = cpMap.get(p);
    const after = nowMap.get(p);
    if (before && after) {
      if (before !== after) diff.push(p);
    } else if (before && !after) {
      diff.push(`${p} (deleted)`);
    } else if (!before && after) {
      diff.push(`${p} (new)`);
    }
  }

  const currentGit = captureGitStatus(repoRoot);
  const gitChanged = currentGit !== checkpoint.gitStatus;

  // Map completed step id -> its completedAtEffect snapshot (file/path hint) for
  // transitive dependency-stale propagation.
  const completedEffectByStep = new Map<string, string | null>();
  for (const s of steps) {
    if (s.status === "completed") {
      completedEffectByStep.set(s.id, s.completedAtEffect);
    }
  }

  // Determine which pending steps become stale:
  //  - a pending step whose own duplicateGuardKey references a changed path
  //  - a pending step whose transitive dependencies reference a changed path
  const changedPaths = diff.map((d) => d.replace(/ \(.*$/, ""));
  const byId = new Map(steps.map((s) => [s.id, s]));
  const staleSteps: string[] = [];
  const visited = new Set<string>();
  const touchesChanged = (keyOrEffect: string | null): boolean => {
    if (!keyOrEffect) return false;
    return changedPaths.some((cp) => keyOrEffect.includes(cp));
  };
  const visit = (id: string): boolean => {
    if (visited.has(id)) return false;
    visited.add(id);
    const step = byId.get(id);
    if (!step) return false;
    if (step.status === "completed") {
      // completed steps are sources; stale propagates if their effect touched changed files
      return touchesChanged(step.completedAtEffect);
    }
    // pending/stale/in-progress/failed: stale if own key touches changed files OR any dependency touches
    let stale = touchesChanged(step.duplicateGuardKey);
    for (const dep of step.dependsOn) {
      if (visit(dep)) stale = true;
    }
    return stale;
  };
  for (const step of steps) {
    if (step.status !== "pending" && step.status !== "stale") continue;
    if (visit(step.id)) staleSteps.push(step.id);
  }

  const passed = diff.length === 0 && !gitChanged && staleSteps.length === 0;

  const reasons: string[] = [];
  if (gitChanged) reasons.push("git status differs from checkpoint");
  if (diff.length > 0) reasons.push(`${diff.length} file(s) changed: ${diff.slice(0, 5).join(", ")}`);
  if (staleSteps.length > 0) reasons.push(`${staleSteps.length} pending step(s) stale due to external edits`);

  return {
    id: "", // assigned by store
    jobId: checkpoint.jobId,
    checkpointId: checkpoint.id,
    validatedAt: new Date().toISOString(),
    passed,
    changesDetected: diff,
    staleSteps,
    reason: reasons.length > 0 ? reasons.join("; ") : "workspace matches checkpoint",
    diff,
  };
}