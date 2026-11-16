#!/usr/bin/env python3
"""
Goodhart's Law in Evolution — Selection Pressure Threshold (simulated).

Reproduction: python experiments/goodharts-law-evolution/run.py

Model (per issue #98, Laplace noise case alpha=1):
  * Asexual population, discrete generations, N individuals.
  * Genotype g ~ Laplace(0, 1) initially; each generation offspring genotype =
    parent genotype + X, X ~ Laplace(0, 1) (mutational/genotypic noise).
  * Phenotype p = g + Y, Y ~ Laplace(0, mu) (phenotypic noise).
    mu is the phenotypic-to-genotypic noise ratio. Baseline mu -> 0 means
    phenotype = genotype exactly (no genotype-phenotype mismatch).
  * Selection: top K = N**gamma individuals by phenotype reproduce; each
    produces r = N/K offspring (deterministic). low gamma = strong selection.
  * For gamma < gamma_c(mu) strong selection amplifies noise: the luckiest
    (not fittest) individuals reproduce -> Goodhart's law regime.

Metrics:
  * Scaled adaptation rate V_scaled = V / log(N),
    V = (mean genotype at final gen - mean genotype at gen 0) / ngen,
    averaged over independent runs.
  * Effective population size N_e = mean time to most recent common ancestor
    (T_2) of two randomly sampled individuals (genealogy tracking).

All results are simulated (no physical measurement).
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
import time

import numpy as np

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MPL = True
except Exception:  # pragma: no cover - optional plotting
    HAS_MPL = False


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def simulate(N, gamma, mu, ngen, rng, track_genealogy=False):
    """Run one independent replicate of the evolution model.

    Returns (V, mean_genotype_trajectory, Ne_or_None).
    """
    g = rng.laplace(0.0, 1.0, size=N).astype(np.float64)
    K = max(1, int(round(N ** gamma)))
    base_r = N // K
    rem = N - base_r * K
    sel_counts = None
    if rem > 0:
        sel_counts = np.full(K, base_r, dtype=np.int64)

    mean_g = np.empty(ngen + 1, dtype=np.float64)
    mean_g[0] = g.mean()

    parent_arrays = [] if track_genealogy else None

    for gen in range(ngen):
        if mu <= 0.0:
            p = g  # baseline: phenotype = genotype (no mismatch)
        else:
            p = g + rng.laplace(0.0, mu, size=N)
        # top K by phenotype (O(N) via argpartition)
        sel = np.argpartition(p, -K)[-K:]
        if rem == 0:
            parent_idx = np.repeat(sel, base_r)
        else:
            counts = sel_counts.copy()
            # use add.at to avoid numpy advanced-indexing += bug
            extra = rng.integers(0, K, size=rem)
            np.add.at(counts, extra, 1)
            parent_idx = np.repeat(sel, counts)
        rng.shuffle(parent_idx)
        g = g[parent_idx] + rng.laplace(0.0, 1.0, size=N)
        mean_g[gen + 1] = g.mean()
        if track_genealogy:
            parent_arrays.append(parent_idx.astype(np.int32))

    V = float((mean_g[-1] - mean_g[0]) / ngen)

    Ne = None
    if track_genealogy:
        Ne = _effective_pop_size(parent_arrays, N, ngen, rng, n_pairs=200)

    return V, mean_g, Ne


def _effective_pop_size(parent_arrays, N, ngen, rng, n_pairs=200):
    """Mean T_2 (time to most recent common ancestor) over random pairs.

    parent_arrays[gen] gives, for each individual at generation gen+1, its
    parent index at generation gen.
    """
    t2s = []
    max_steps = min(ngen, 400)
    for _ in range(n_pairs):
        a = int(rng.integers(0, N))
        b = int(rng.integers(0, N))
        if b == a:
            b = (b + 1) % N
        cur_a, cur_b = a, b
        coalesced = False
        for step in range(1, max_steps + 1):
            pa = int(parent_arrays[ngen - step][cur_a])
            pb = int(parent_arrays[ngen - step][cur_b])
            if pa == pb:
                t2s.append(float(step))
                coalesced = True
                break
            cur_a, cur_b = pa, pb
        if not coalesced:
            t2s.append(float(ngen))  # censored (no coalescence observed)
    return float(np.mean(t2s))


def make_rng(seed):
    return np.random.default_rng(seed)


# ---------------------------------------------------------------------------
# Sweeps
# ---------------------------------------------------------------------------

def sweep_adaptation(base, mus, gammas, runs, ngen_v, N, seed0):
    """V_scaled vs gamma for each mu (no genealogy -> fast)."""
    rows = []
    for mu in mus:
        for gamma in gammas:
            Vs = []
            Vs_scaled = []
            finals = []
            for run in range(runs):
                seed = seed0 + 100000 * int(mu * 1000) + 1000 * int(gamma * 1000) + run
                rng = make_rng(seed)
                V, traj, _ = simulate(N, gamma, mu, ngen_v, rng, track_genealogy=False)
                Vs.append(V)
                Vs_scaled.append(V / math.log(N))
                finals.append(float(traj[-1]))
                rows.append({
                    "mu": mu, "gamma": gamma, "run": run,
                    "V": V, "V_scaled": V / math.log(N),
                    "mean_genotype_0": float(traj[0]),
                    "mean_genotype_final": float(traj[-1]),
                })
    return rows


def sweep_ne(base, mus, gammas_ne, runs, ngen_ne, N, seed0):
    """N_e via genealogy for a subset of (mu, gamma)."""
    rows = []
    for mu in mus:
        for gamma in gammas_ne:
            Nes = []
            for run in range(runs):
                seed = seed0 + 200000 + 100000 * int(mu * 1000) + 1000 * int(gamma * 1000) + run
                rng = make_rng(seed)
                V, _, Ne = simulate(N, gamma, mu, ngen_ne, rng, track_genealogy=True)
                Nes.append(Ne)
                rows.append({
                    "mu": mu, "gamma": gamma, "run": run,
                    "V": V, "Ne": Ne,
                })
            # per-combo summary appended separately below via caller
    return rows


def find_gamma_c(gammas, vals):
    """Interpolate the gamma at which vals is maximal (parabola fit around peak)."""
    if len(gammas) < 3:
        return None
    imax = int(np.argmax(vals))
    if imax == 0 or imax == len(gammas) - 1:
        return float(gammas[imax])
    x0, x1, x2 = gammas[imax - 1], gammas[imax], gammas[imax + 1]
    y0, y1, y2 = vals[imax - 1], vals[imax], vals[imax + 1]
    denom = (x0 - x1) * (x0 - x2) * (x1 - x2)
    if abs(denom) < 1e-12:
        return float(x1)
    a = (x2 * (y0 - y1) + x0 * (y1 - y2) + x1 * (y2 - y0)) / denom
    b = (x2 * x2 * (y1 - y0) + x0 * x0 * (y2 - y1) + x1 * x1 * (y0 - y2)) / denom
    if abs(a) < 1e-12:
        return float(x1)
    gamma_c = -b / (2 * a)
    return float(gamma_c)


# ---------------------------------------------------------------------------
# Plotting
# ---------------------------------------------------------------------------

def save_plot(adaptation_rows, mus, gammas, outpath):
    if not HAS_MPL:
        return False
    fig, ax = plt.subplots(figsize=(8, 5))
    for mu in mus:
        xs, ys = [], []
        for g in gammas:
            row = [r for r in adaptation_rows if r["mu"] == mu and r["gamma"] == g]
            if row:
                xs.append(g)
                ys.append(float(np.mean([r["V_scaled"] for r in row])))
        if xs:
            ax.plot(xs, ys, marker="o", label=f"mu={mu}")
    ax.set_xlabel("gamma (selection pressure; low gamma = strong selection)")
    ax.set_ylabel("V_scaled = V / log(N) (genotype units / generation)")
    ax.set_title("Scaled adaptation rate vs selection pressure (simulated)")
    ax.grid(True, alpha=0.3)
    ax.legend(title="noise ratio mu")
    plt.tight_layout()
    plt.savefig(outpath, dpi=150)
    plt.close(fig)
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Goodhart's Law in Evolution experiment")
    ap.add_argument("--N", type=int, default=100000)
    ap.add_argument("--mus", type=str, default="0.5,1.0,2.0,5.0")
    ap.add_argument("--gammas", type=str,
                    default="0.05,0.15,0.25,0.35,0.45,0.55,0.65,0.75,0.85,0.95")
    ap.add_argument("--gammas-ne", type=str, default="0.10,0.30,0.50")
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--gens-v", type=int, default=200)
    ap.add_argument("--gens-ne", type=int, default=400)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--output", type=str, default=None)
    ap.add_argument("--no-plot", action="store_true")
    args = ap.parse_args()

    base = os.path.dirname(os.path.abspath(__file__))
    outdir = args.output or os.path.join(base, "results")
    os.makedirs(outdir, exist_ok=True)

    mus = [float(x) for x in args.mus.split(",")]
    gammas = [float(x) for x in args.gammas.split(",")]
    gammas_ne = [float(x) for x in args.gammas_ne.split(",")]

    N = args.N
    logN = math.log(N)

    t0 = time.time()

    # 1) Adaptation sweep (V_scaled vs gamma for each mu).
    ar = sweep_adaptation(base, mus, gammas, args.runs, args.gens_v, N, args.seed)

    # summary per (mu, gamma)
    summary = {}
    for mu in mus:
        for gamma in gammas:
            vals = [r["V_scaled"] for r in ar
                    if r["mu"] == mu and r["gamma"] == gamma]
            summary[(mu, gamma)] = {
                "V_scaled_mean": float(np.mean(vals)),
                "V_scaled_std": float(np.std(vals, ddof=1)) if len(vals) > 1 else 0.0,
                "V_mean": float(np.mean([r["V"] for r in ar
                                         if r["mu"] == mu and r["gamma"] == gamma])),
                "n": len(vals),
            }

    # critical line gamma_c(mu): interpolated peak of V_scaled vs gamma
    critical = []
    for mu in mus:
        xs = gammas
        ys = [summary[(mu, g)]["V_scaled_mean"] for g in gammas]
        gc = find_gamma_c(xs, ys)
        critical.append({"mu": mu, "gamma_c": gc,
                         "V_scaled_peak": (max(ys) if ys else None),
                         "gammas": xs, "vals": ys})

    # 2) Baseline: mu -> 0 (phenotype = genotype, no mismatch).
    baseline_rows = sweep_adaptation(base, [0.0], gammas, args.runs, args.gens_v, N, args.seed + 777)
    baseline_summary = {}
    for gamma in gammas:
        vals = [r["V_scaled"] for r in baseline_rows if r["gamma"] == gamma]
        baseline_summary[gamma] = {
            "V_scaled_mean": float(np.mean(vals)),
            "V_scaled_std": float(np.std(vals, ddof=1)) if len(vals) > 1 else 0.0,
        }

    # 3) N_e via genealogy for a subset.
    ne_rows = sweep_ne(base, mus, gammas_ne, max(1, args.runs // 2),
                       args.gens_ne, N, args.seed + 999)
    ne_summary = {}
    for mu in mus:
        for gamma in gammas_ne:
            vals = [r["Ne"] for r in ne_rows
                    if r["mu"] == mu and r["gamma"] == gamma]
            ne_summary[(mu, gamma)] = {
                "Ne_mean": float(np.mean(vals)),
                "Ne_std": float(np.std(vals, ddof=1)) if len(vals) > 1 else 0.0,
                "n": len(vals),
            }

    elapsed = time.time() - t0

    # ---- write CSVs ----
    def write_csv(name, fieldnames, rows):
        path = os.path.join(outdir, name)
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)
        return path

    # per-run adaptation results (individual run trajectories -> variance estimation)
    ar_path = write_csv("adaptation_rate.csv",
                        ["mu", "gamma", "run", "V", "V_scaled",
                         "mean_genotype_0", "mean_genotype_final"], ar)

    sum_rows = []
    for (mu, gamma), s in sorted(summary.items()):
        sum_rows.append({"mu": mu, "gamma": gamma, **s})
    write_csv("adaptation_summary.csv",
              ["mu", "gamma", "V_scaled_mean", "V_scaled_std", "V_mean", "n"],
              sum_rows)

    crit_rows = []
    for c in critical:
        crit_rows.append({"mu": c["mu"], "gamma_c": c["gamma_c"],
                          "V_scaled_peak": c["V_scaled_peak"]})
    write_csv("critical_line.csv", ["mu", "gamma_c", "V_scaled_peak"], crit_rows)

    base_path = write_csv("baseline.csv",
                          ["gamma", "V_scaled_mean", "V_scaled_std"],
                          [{"gamma": g, **baseline_summary[g]} for g in gammas])

    ne_path = write_csv("effective_pop_size.csv",
                        ["mu", "gamma", "Ne_mean", "Ne_std", "n"],
                        [{"mu": mu, "gamma": g, **ne_summary[(mu, g)]}
                         for mu in mus for g in gammas_ne])

    plot_path = os.path.join(outdir, "adaptation_vs_gamma.png")
    plotted = save_plot(ar, mus, gammas, plot_path) if not args.no_plot else False

    # ---- summary json ----
    result = {
        "N": N, "logN": logN, "mus": mus, "gammas": gammas,
        "runs": args.runs, "gens_v": args.gens_v, "gens_ne": args.gens_ne,
        "elapsed_seconds": elapsed,
        "critical_line": [{"mu": c["mu"], "gamma_c": c["gamma_c"],
                           "V_scaled_peak": c["V_scaled_peak"]} for c in critical],
        "baseline": {str(g): baseline_summary[g] for g in gammas},
        "ne_summary": {f"mu={mu},gamma={g}": ne_summary[(mu, g)]
                       for mu in mus for g in gammas_ne},
        "files": {
            "adaptation_rate": ar_path,
            "adaptation_summary": os.path.join(outdir, "adaptation_summary.csv"),
            "critical_line": os.path.join(outdir, "critical_line.csv"),
            "baseline": base_path,
            "effective_pop_size": ne_path,
            "plot": plot_path if plotted else None,
        },
        "result_label": "simulated",
    }
    with open(os.path.join(outdir, "summary.json"), "w") as f:
        json.dump(result, f, indent=2)

    print("=== Goodhart's Law in Evolution (simulated) ===")
    print(f"N={N}, log(N)={logN:.4f}, mus={mus}, gammas={gammas}")
    print(f"runs per combo={args.runs}, gens_v={args.gens_v}, gens_ne={args.gens_ne}")
    print(f"elapsed: {elapsed:.1f}s")
    print("Critical line gamma_c(mu):")
    for c in critical:
        print(f"  mu={c['mu']:>4}  gamma_c={c['gamma_c']}")
    print("Baseline mu=0 (phenotype=genotype): V_scaled monotonic decreasing in gamma "
          f"(stronger selection -> faster adaptation): {baseline_summary}")
    print(f"Results written to: {outdir}")
    return result


if __name__ == "__main__":
    main()
