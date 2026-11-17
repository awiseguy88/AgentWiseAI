import type { Job, ResumePlan, Step } from "./types.js";
import { validateWorkspace } from "./revalidate.js";

export interface ReplanInput {
  job: Job;
  steps: Step[];
  checkpoint: any;
  repoRoot: string;
}

/**
 * Produce a resume plan from a validated checkpoint.
 *
 * Rules:
 * - completed steps are never replayed (their completed_at_effect is preserved)
 * - stale steps are marked and will be re-planned
 * - pending steps whose dependencies are completed stay pending
 * - acceptance criteria are not auto-checked here; the service calls accept() after
 *   all steps complete
 */
export function replan(input: ReplanInput): ResumePlan {
  const { job, steps, repoRoot } = input;
  const checkpoint = input.checkpoint;
  const validation = validateWorkspace(repoRoot, checkpoint, steps);

  const completedSteps: Step[] = [];
  const pendingSteps: Step[] = [];
  const staleSteps: Step[] = [];
  const replaySkipped: string[] = [];
  const actions: string[] = [];

  const staleSet = new Set(validation.staleSteps);

  for (const step of steps) {
    if (step.status === "completed") {
      completedSteps.push(step);
      replaySkipped.push(step.id);
      actions.push(`keep completed step "${step.name}" (effect preserved, not replayed)`);
      continue;
    }
    if (staleSet.has(step.id)) {
      staleSteps.push(step);
      actions.push(`mark step "${step.name}" stale — external file change detected, revise plan`);
      continue;
    }
    pendingSteps.push(step);
    const depStatus = step.dependsOn
      .map((d) => {
        const dep = steps.find((s) => s.id === d);
        return dep ? `${dep.name}:${dep.status}` : `${d}:missing`;
      })
      .join(", ");
    actions.push(`queue step "${step.name}" (deps: ${depStatus})`);
  }

  return {
    job,
    validation,
    completedSteps,
    pendingSteps,
    staleSteps,
    replaySkipped,
    actions,
  };
}

/**
 * Decide whether the job can reach completed.
 * A job completes only when:
 *   1. no step is pending/stale/in-progress/failed
 *   2. acceptance criteria are asserted (checked by the service via acceptance checks)
 *   3. no duplicate external effect would be produced
 *
 * Returns { ok, reason }.
 */
export function canComplete(steps: Step[], acceptanceAsserted: boolean): { ok: boolean; reason: string | null } {
  const bad = steps.find(
    (s) => s.status === "pending" || s.status === "stale" || s.status === "in-progress" || s.status === "failed",
  );
  if (bad) {
    return { ok: false, reason: `step "${bad.name}" is not complete (status=${bad.status})` };
  }
  if (!acceptanceAsserted) {
    return { ok: false, reason: "acceptance criteria have not passed yet" };
  }
  return { ok: true, reason: null };
}