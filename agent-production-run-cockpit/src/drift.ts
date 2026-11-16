import { DriftComparison, NormalizedRun } from "./types.js";

export interface RegressionRecord {
  run_id: string;
  workflow?: string;
  customer?: string;
  model?: string;
  model_version?: string;
  score: number; // held-out regression score 0..1
}

/**
 * Compare regression results across model versions.
 * Runs missing model_version are reported as unversioned and EXCLUDED from
 * drift comparison (never silently passing).
 */
export function compareDrift(
  baseline: RegressionRecord[],
  current: RegressionRecord[],
  runs?: NormalizedRun[],
): DriftComparison[] {
  // Identify unversioned runs from current set and from ingested runs
  const unversioned = new Set<string>();
  const excluded = new Set<string>();
  for (const r of current) {
    if (!r.model_version) {
      unversioned.add(r.run_id);
      excluded.add(r.run_id);
    }
  }
  if (runs) {
    for (const r of runs) {
      if (r.unversioned) {
        unversioned.add(r.run_id);
        excluded.add(r.run_id);
      }
    }
  }

  // Group by workflow for comparison
  const workflows = new Set<string>();
  for (const r of [...baseline, ...current]) workflows.add(r.workflow ?? "default");

  const out: DriftComparison[] = [];
  for (const wf of workflows) {
    const b = baseline.filter((r) => (r.workflow ?? "default") === wf);
    const cAll = current.filter((r) => (r.workflow ?? "default") === wf);
    const c = cAll.filter((r) => r.model_version); // exclude unversioned from comparison

    const bScore = b.length ? b.reduce((a, x) => a + x.score, 0) / b.length : 0;
    const cScore = c.length ? c.reduce((a, x) => a + x.score, 0) / c.length : 0;
    const delta = cScore - bScore;
    const compared = b.length > 0 && c.length > 0;
    const verdict: "keep" | "investigate" = !compared ? "investigate" : delta < -0.05 ? "investigate" : "keep";

    const diff = c.map((r) => {
      const base = b.find((x) => x.run_id === r.run_id || x.workflow === r.workflow);
      const baseScore = base?.score;
      return {
        run_id: r.run_id,
        baseline: baseScore,
        current: r.score,
        delta: baseScore != null ? r.score - baseScore : undefined,
      };
    });

    out.push({
      workflow: wf,
      baseline_version: b.find((x) => x.model_version)?.model_version,
      current_version: c.find((x) => x.model_version)?.model_version,
      baseline_score: bScore,
      current_score: cScore,
      delta,
      compared,
      unversioned_runs: [...unversioned],
      excluded_runs: [...excluded],
      verdict,
      diff,
    });
  }

  if (out.length === 0) {
    out.push({
      workflow: "default",
      baseline_score: 0,
      current_score: 0,
      delta: 0,
      compared: false,
      unversioned_runs: [...unversioned],
      excluded_runs: [...excluded],
      verdict: "investigate",
      diff: [],
    });
  }

  return out;
}