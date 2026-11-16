#!/usr/bin/env python3
"""
SIS Epidemic Threshold on Random Regular Graphs — Finite-Size Correction.

Reproduction: python experiments/sis-epidemic-threshold/run.py

Continuous-time SIS (Gillespie direct method) on random d-regular graphs
(d = 3, recovery rate μ = 1), estimating the effective epidemic threshold
τ_c^eff(N) from the quasistationary infected-fraction curve f*(τ) with a
95% bootstrap CI. All results are simulated (no physical measurement).

Per-edge infection rate: each infected node infects each susceptible neighbor
at rate τ. Recovery rate μ = 1 per infected node.

Gillespie direct method with an efficient cut-edge structure:
  - C = number of directed edges from infected -> susceptible nodes (the cut).
  - Each cut edge is an infection event (rate τ); each infected node is a
    recovery event (rate μ). Total rate R = τ·C + μ·I.
  - Pick next event proportional to rate; infection = infect the target of a
    uniformly random cut edge; recovery = recover a uniformly random infected node.
  - Cut-edge structure maintained with swap-with-last for O(1) updates.

Run:
  python experiments/sis-epidemic-threshold/run.py          # full experiment
  python experiments/sis-epidemic-threshold/run.py --help   # options
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
    import networkx as nx
    HAS_NX = True
except Exception:  # pragma: no cover - networkx optional (fallback generator)
    HAS_NX = False


# ---------------------------------------------------------------------------
# Random d-regular graph generation
# ---------------------------------------------------------------------------

def random_d_regular_graph(d: int, n: int, rng: np.random.Generator):
    """Return adjacency list of a random d-regular simple graph on n nodes."""
    if HAS_NX:
        G = nx.random_regular_graph(d, n, seed=int(rng.integers(0, 2 ** 31 - 1)))
        return [np.array(sorted(G.neighbors(i)), dtype=np.int32) for i in range(n)]
    # Fallback: configuration model + stub pairing, retry until simple.
    stubs = np.repeat(np.arange(n, dtype=np.int32), d)
    attempts = 0
    max_attempts = 1000
    while attempts < max_attempts:
        attempts += 1
        perm = rng.permutation(stubs.size)
        a = stubs[: perm.size // 2]
        b = stubs[perm.size // 2:]
        pairs = np.stack([a[perm[: perm.size // 2]], b], axis=1)
        edges = []
        simple = True
        seen = set()
        for u, v in pairs:
            u = int(u); v = int(v)
            if u == v:
                simple = False; break
            key = (u, v) if u < v else (v, u)
            if key in seen:
                simple = False; break
            seen.add(key)
            edges.append((u, v))
        if simple:
            adj = [[] for _ in range(n)]
            for u, v in edges:
                adj[u].append(v)
                adj[v].append(u)
            return [np.array(x, dtype=np.int32) for x in adj]
    raise RuntimeError("Failed to generate a simple random regular graph")


# ---------------------------------------------------------------------------
# Gillespie SIS simulator (direct method, cut-edge structure)
# ---------------------------------------------------------------------------

class SISGillespie:
    """Exact Gillespie simulation of continuous-time SIS on a fixed graph."""

    def __init__(self, adj, tau: float, mu: float, rng: np.random.Generator):
        self.n = len(adj)
        self.adj = adj
        self.tau = tau
        self.mu = mu
        self.state = np.zeros(self.n, dtype=np.int8)  # 0=S, 1=I
        self.rng = rng
        # number of susceptible neighbors per node (only meaningful while S/I)
        self.sus = np.full(self.n, adj[0].size, dtype=np.int32)
        # infected node list (swap-remove)
        self.inf = []
        # cut edges: directed infected -> susceptible
        self.cut_src: list[int] = []
        self.cut_tgt: list[int] = []
        # per-node indices into cut arrays where node is source (infected) / target (susceptible)
        self.src_edges: list[list[int]] = [[] for _ in range(self.n)]
        self.tgt_edges: list[list[int]] = [[] for _ in range(self.n)]
        self.n_events = 0
        self.n_absorptions = 0
        self.n_reintroductions = 0
        self.t = 0.0

        # Seed: infect one random node.
        self._infect_node(int(self.rng.integers(0, self.n)))

    # -- cut-edge bookkeeping ------------------------------------------------

    def _add_cut(self, u: int, v: int):
        idx = len(self.cut_src)
        self.cut_src.append(u)
        self.cut_tgt.append(v)
        self.src_edges[u].append(idx)
        self.tgt_edges[v].append(idx)

    def _remove_from(self, lst: list[int], val: int):
        """Remove one occurrence of val from a small list (swap-with-last)."""
        pos = lst.index(val)  # list is tiny (≤ d)
        last = lst[-1]
        lst[pos] = last
        lst.pop()

    def _replace_val(self, lst: list[int], old: int, new: int):
        """Replace one occurrence of old with new in a small list."""
        pos = lst.index(old)
        lst[pos] = new

    def _remove_cut(self, idx: int):
        orig_src = self.cut_src[idx]
        orig_tgt = self.cut_tgt[idx]
        last = len(self.cut_src) - 1
        if idx != last:
            us = self.cut_src[last]
            vs = self.cut_tgt[last]
            self.cut_src[idx] = us
            self.cut_tgt[idx] = vs
            self._replace_val(self.src_edges[us], last, idx)
            self._replace_val(self.tgt_edges[vs], last, idx)
        self.cut_src.pop()
        self.cut_tgt.pop()
        self._remove_from(self.src_edges[orig_src], idx)
        self._remove_from(self.tgt_edges[orig_tgt], idx)

    def _add_neighbors_as_cut(self, u: int):
        """u just became infected: add cut edges u->v for susceptible neighbors v."""
        for v in self.adj[u]:
            if self.state[v] == 0:
                self._add_cut(u, int(v))
                self.sus[v] -= 1  # v loses a susceptible neighbor (u)

    def _remove_neighbors_as_cut(self, u: int):
        """u just became susceptible: remove cut edges u->v (u no longer infected)."""
        for v in self.adj[u]:
            if self.state[v] == 0:
                # cut edge (u -> v) existed
                # find its index
                for idx in self.src_edges[u]:
                    if self.cut_tgt[idx] == v:
                        self._remove_cut(idx)
                        break
                self.sus[v] += 1

    def _infect_node(self, u: int):
        """Set node u infected; update cut structure and neighbor sus counts."""
        self.state[u] = 1
        self.inf.append(u)
        # recompute sus[u] = number of susceptible neighbors
        su = 0
        for v in self.adj[u]:
            if self.state[v] == 0:
                su += 1
        self.sus[u] = su
        for v in self.adj[u]:
            if self.state[v] == 0:
                # edge (u -> v) becomes a cut edge
                self._add_cut(u, int(v))
                self.sus[v] -= 1
            else:
                # v infected: edge (v -> u) was a cut edge; now u infected -> remove it
                for idx in self.src_edges[v]:
                    if self.cut_tgt[idx] == u:
                        self._remove_cut(idx)
                        break

    def _recover_node(self, u: int):
        """Set node u susceptible; update cut structure and neighbor sus counts."""
        self.state[u] = 0
        self._remove_from(self.inf, u)
        # sus[u] = number of susceptible neighbors now
        su = 0
        for v in self.adj[u]:
            if self.state[v] == 0:
                su += 1
        self.sus[u] = su
        for v in self.adj[u]:
            if self.state[v] == 0:
                # edge (u -> v) was a cut edge (u infected, v susceptible); remove it
                for idx in self.src_edges[u]:
                    if self.cut_tgt[idx] == v:
                        self._remove_cut(idx)
                        break
                self.sus[v] += 1
            else:
                # v infected: edge (v -> u) becomes a cut edge (v infected, u now susceptible)
                self._add_cut(v, u)

    # -- dynamics ------------------------------------------------------------

    def step(self):
        """Single Gillespie event. Returns event type ('infection'/'recovery')."""
        c = len(self.cut_src)
        i = len(self.inf)
        if c == 0 and i == 0:
            return "stuck"
        rate_inf = self.tau * c
        rate_rec = self.mu * i
        total = rate_inf + rate_rec
        r1 = self.rng.random()
        dt = -math.log(max(r1, 1e-300)) / total
        self.t += dt
        self.n_events += 1
        if self.rng.random() * total < rate_inf:
            # infection: pick uniform cut edge
            idx = int(self.rng.integers(0, c))
            v = self.cut_tgt[idx]
            self._infect_node(v)
            return "infection"
        else:
            # recovery: pick uniform infected node
            u = self.inf[int(self.rng.integers(0, i))]
            self._recover_node(u)
            return "recovery"

    def run(self, n_burnin: int, n_sample: int, reintroduce: bool = True):
        """Burn-in n_burnin events, then sample n_sample events.

        Returns dict with prevalence time series, mean infected fraction, and
        absorption/reintroduction counts measured over the sampling window.
        """
        for _ in range(n_burnin):
            ev = self.step()
            if ev == "stuck":
                break
            # absorbing state reached during burn-in: reintroduce
            if reintroduce and len(self.inf) == 0:
                self._infect_node(int(self.rng.integers(0, self.n)))
                self.n_reintroductions += 1

        f_series = []
        absorptions_in_sample = 0
        reintroductions_in_sample = 0
        hit_absorbing = False

        for _ in range(n_sample):
            ev = self.step()
            if ev == "stuck":
                break
            f_series.append(float(len(self.inf)) / self.n)
            if len(self.inf) == 0:
                hit_absorbing = True
                absorptions_in_sample += 1
                if reintroduce:
                    self._infect_node(int(self.rng.integers(0, self.n)))
                    self.n_reintroductions += 1
                    reintroductions_in_sample += 1

        f_series = np.asarray(f_series, dtype=np.float64)
        f_mean = float(f_series.mean()) if f_series.size else 0.0
        f_var = float(f_series.var()) if f_series.size > 1 else 0.0

        return {
            "f_mean": f_mean,
            "f_var": f_var,
            "n_events": self.n_events,
            "absorptions": absorptions_in_sample,
            "reintroductions": reintroductions_in_sample,
            "hit_absorbing": bool(hit_absorbing),
            "t": float(self.t),
        }


def simulate_once(adj, tau: float, mu: float, rng: np.random.Generator,
                  n_burnin: int, n_sample: int, reintroduce: bool = True):
    sim = SISGillespie(adj, tau, mu, rng)
    return sim.run(n_burnin, n_sample, reintroduce=reintroduce)


# ---------------------------------------------------------------------------
# Threshold estimation (logistic fit to mean f*(tau) curve)
# ---------------------------------------------------------------------------

def logistic_fit(taus, fmeans):
    """Fit f*(tau) = L0 + (L1-L0)/(1+exp(-k*(tau-tau_c))). Returns tau_c or None."""
    taus = np.asarray(taus, dtype=np.float64)
    fmeans = np.asarray(fmeans, dtype=np.float64)
    if taus.size < 4:
        return None
    y = fmeans
    L0 = float(np.min(y))
    L1 = float(np.max(y))
    span = L1 - L0
    if span <= 1e-6:
        return None  # flat curve -> no identifiable threshold
    y0 = max(L0, 1e-9)
    y1 = min(L1, 1.0 - 1e-9)
    # initial tau_c: tau where f crosses mid
    mid = 0.5 * (L0 + L1)
    cross = None
    for k in range(1, taus.size):
        if (y[k - 1] <= mid) != (y[k] <= mid):
            cross = float(taus[k - 1] + (mid - y[k - 1]) * (taus[k] - taus[k - 1]) / max(y[k] - y[k - 1], 1e-12))
            break
    if cross is None:
        cross = float(np.mean(taus))

    def model(t, L0_, L1_, k_, tc_):
        return L0_ + (L1_ - L0_) / (1.0 + np.exp(-k_ * (t - tc_)))

    p0 = [L0, L1, 20.0, cross]
    bounds = ([-np.inf, -np.inf, 1e-3, taus.min() - 1.0],
              [np.inf, np.inf, 1e3, taus.max() + 1.0])
    try:
        from scipy.optimize import curve_fit
        popt, _ = curve_fit(model, taus, y, p0=p0, bounds=bounds, maxfev=20000)
        return float(popt[3])
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Sweep / aggregation
# ---------------------------------------------------------------------------

def run_experiment(N_list, tau_list, graphs_per_N, runs_per_N, n_burnin, n_sample,
                   master_seed, reintroduce=True, progress=None):
    """Run the full experiment across N values and tau grid.

    Returns (rows, per_N) where rows is the flat list of unit results and per_N
    maps N -> {taus, fmeans, fses, n_graphs, n_runs, units}.
    Graphs are generated once per (N, graph index) and reused across tau values.
    """
    rows = []
    per_N = {}
    total_cells = len(N_list) * len(tau_list)
    cell = 0
    for N in N_list:
        n_graphs = graphs_per_N.get(N, 10)
        n_runs = runs_per_N.get(N, 5)
        # Generate graphs once per (N, graph index).
        graphs = []
        for g in range(n_graphs):
            rng_g = np.random.default_rng(master_seed + 100003 * N + 7 * g)
            graphs.append(random_d_regular_graph(3, N, rng_g))
        fmeans = []
        fses = []
        unit_count = 0
        for tau in tau_list:
            tau_fs = []
            for g in range(n_graphs):
                adj = graphs[g]
                rng = np.random.default_rng(master_seed + 1000003 * N + 1000 * g + int(round(tau * 10000)))
                for r in range(n_runs):
                    run_rng = np.random.default_rng(int(rng.integers(0, 2 ** 31 - 1)))
                    res = simulate_once(adj, tau, 1.0, run_rng,
                                        int(round(n_burnin * N)),
                                        int(round(n_sample * N)),
                                        reintroduce=reintroduce)
                    rows.append({
                        "N": N,
                        "tau": tau,
                        "graph": g,
                        "run": r,
                        "seed": int(run_rng.integers(0, 2 ** 31 - 1)),
                        "f_mean": res["f_mean"],
                        "f_var": res["f_var"],
                        "absorptions": res["absorptions"],
                        "reintroductions": res["reintroductions"],
                        "hit_absorbing": int(res["hit_absorbing"]),
                        "n_events": res["n_events"],
                        "t": res["t"],
                    })
                    tau_fs.append(res["f_mean"])
                    unit_count += 1
            cell += 1
            if progress:
                progress(cell, total_cells, N, tau, unit_count)
            fmeans.append(float(np.mean(tau_fs)))
            fses.append(float(np.std(tau_fs, ddof=1) / math.sqrt(len(tau_fs))) if len(tau_fs) > 1 else 0.0)
        per_N[N] = {"taus": list(tau_list), "fmeans": fmeans, "fses": fses,
                    "n_graphs": n_graphs, "n_runs": n_runs, "units": unit_count}
    return rows, per_N


def estimate_tau_c(taus, fmeans):
    """Estimate tau_c^eff from the mean f*(tau) curve via logistic fit."""
    tc = logistic_fit(taus, fmeans)
    return tc


# ---------------------------------------------------------------------------
# Bootstrap CI for tau_c
# ---------------------------------------------------------------------------

def bootstrap_tau_c(N, per_N, rows_by_unit, B, rng_seed):
    """Bootstrap 95% CI for tau_c^eff(N) by resampling unit rows with replacement."""
    units = rows_by_unit[N]
    if len(units) < 2:
        return None, None, None
    rng = np.random.default_rng(rng_seed)
    tcs = []
    taus = per_N[N]["taus"]
    fmeans_orig = per_N[N]["fmeans"]
    tau_to_idx = {t: i for i, t in enumerate(taus)}
    for _ in range(B):
        idx = rng.integers(0, len(units), size=len(units))
        # aggregate f* per tau over resampled units
        agg = {}
        for j in idx:
            u = units[j]
            agg.setdefault(u["tau"], []).append(u["f_mean"])
        fmeans_b = []
        for i, t in enumerate(taus):
            if t in agg:
                fmeans_b.append(float(np.mean(agg[t])))
            else:
                # Fallback if a tau is missing from the resample (rare).
                fmeans_b.append(float(fmeans_orig[i]))
        tc = estimate_tau_c(taus, fmeans_b)
        if tc is not None:
            tcs.append(tc)
    if len(tcs) == 0:
        return None, None, None
    tcs = np.asarray(tcs)
    lo = float(np.percentile(tcs, 2.5))
    hi = float(np.percentile(tcs, 97.5))
    return float(np.mean(tcs)), lo, hi


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="SIS epidemic threshold finite-size experiment.")
    ap.add_argument("--N", type=str, default="500,1000,2000,4000",
                    help="comma-separated node counts")
    ap.add_argument("--tau-list", type=str, default="0.30,0.36,0.40,0.44,0.48,0.52,0.56,0.60,0.65",
                    help="comma-separated tau grid")
    ap.add_argument("--graphs", type=str, default="4,4,3,3",
                    help="comma-separated graphs per N (matched to N order)")
    ap.add_argument("--runs", type=str, default="2,2,2,2",
                    help="comma-separated runs per graph per N")
    ap.add_argument("--burnin", type=float, default=5.0,
                    help="burn-in events as multiple of N")
    ap.add_argument("--sample", type=float, default=20.0,
                    help="sampling events as multiple of N")
    ap.add_argument("--seed", type=int, default=20261116)
    ap.add_argument("--bootstrap", type=int, default=200,
                    help="bootstrap resamples for 95%% CI on tau_c^eff")
    ap.add_argument("--no-reintro", action="store_true",
                    help="disable reintroduction after absorbing state")
    ap.add_argument("--no-plot", action="store_true", help="suppress plotting (no-op)")
    ap.add_argument("--output", type=str, default=None,
                    help="results directory (default: results/ next to this file)")
    args = ap.parse_args()

    N_list = [int(x) for x in args.N.split(",")]
    tau_list = [float(x) for x in args.tau_list.split(",")]
    graphs_vals = [int(x) for x in args.graphs.split(",")]
    runs_vals = [int(x) for x in args.runs.split(",")]
    if len(graphs_vals) != len(N_list) or len(runs_vals) != len(N_list):
        print("FAIL: --graphs and --runs must have one value per --N", file=sys.stderr)
        return 2
    graphs_per_N = {n: v for n, v in zip(N_list, graphs_vals)}
    runs_per_N = {n: v for n, v in zip(N_list, runs_vals)}

    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = args.output or os.path.join(base, "results")
    os.makedirs(results_dir, exist_ok=True)

    master_seed = args.seed
    reintroduce = not args.no_reintro

    t0 = time.time()
    progress = lambda c, tot, N, tau, uc: print(
        f"  [{c}/{tot}] N={N} tau={tau:.2f} units={uc}", end="\r")
    print(f"SIS experiment: N={N_list}, tau grid={tau_list}")
    print(f"  graphs per N: {graphs_per_N}, runs per graph: {runs_per_N}")
    print(f"  burnin={args.burnin}N, sample={args.sample}N, reintroduce={reintroduce}, seed={master_seed}")

    rows, per_N = run_experiment(N_list, tau_list, graphs_per_N, runs_per_N,
                                 args.burnin, args.sample, master_seed,
                                 reintroduce=reintroduce, progress=progress)
    print()
    print(f"Simulation complete in {time.time() - t0:.1f}s; {len(rows)} unit runs.")
    # Per-N mean curve + tau_c estimate (aggregate over units)
    rows_by_unit = {N: [r for r in rows if r["N"] == N] for N in N_list}
    B = args.bootstrap
    summaries = []
    for N in N_list:
        pn = per_N[N]
        taus = pn["taus"]
        fmeans = pn["fmeans"]
        fses = pn["fses"]
        tc_point = estimate_tau_c(taus, fmeans)
        tc_mean, tc_lo, tc_hi = bootstrap_tau_c(
            N, per_N, rows_by_unit, B, master_seed + 9973 + N)
        summaries.append({
            "N": N,
            "taus": taus,
            "fmeans": fmeans,
            "fses": fses,
            "n_graphs": pn["n_graphs"],
            "n_runs": pn["n_runs"],
            "units": pn["units"],
            "tau_c_point": tc_point,
            "tau_c_boot_mean": tc_mean,
            "tau_c_ci_lo": tc_lo,
            "tau_c_ci_hi": tc_hi,
            "result_label": "simulated",
        })
        print(f"N={N}: tau_c^eff = {tc_point}" + (
            f"  boot 95% CI [{tc_lo:.4f}, {tc_hi:.4f}]" if tc_lo is not None else ""
        ) + (f"  n={pn['units']} units"))

    # Verdict
    s4000 = next((s for s in summaries if s["N"] == 4000), None)
    verdict = "inconclusive"
    pass_detail = []
    fail_detail = []
    if s4000 is not None and s4000["tau_c_point"] is not None and s4000["tau_c_ci_lo"] is not None:
        tc4000 = s4000["tau_c_point"]
        dev = abs(tc4000 - 0.5)
        # trend: tau_c increasing with N (regression slope) and CI trend
        ns = [s["N"] for s in summaries if s["tau_c_point"] is not None]
        tcs = [s["tau_c_point"] for s in summaries if s["tau_c_point"] is not None]
        trend_up = False
        if len(ns) >= 2:
            slope = np.polyfit(ns, tcs, 1)[0]
            trend_up = slope > 0
        pass_detail.append(f"|tau_c^eff(4000)-0.5| = {dev:.4f} (threshold 0.03)")
        pass_detail.append(f"trend increasing with N: {trend_up} (slope over points {[(n, round(tc,4)) for n, tc in zip(ns, tcs)]})")
        if dev <= 0.03 and trend_up:
            verdict = "supported"
        elif dev > 0.08 or not trend_up:
            verdict = "unsupported"
        else:
            verdict = "inconclusive"
    else:
        pass_detail.append("tau_c^eff(4000) could not be estimated (noise)")
        verdict = "inconclusive"

    summary = {
        "experiment": "sis-epidemic-threshold",
        "issue": 105,
        "d": 3,
        "mu": 1.0,
        "baseline_tau_c_mf": 0.5,
        "N_list": N_list,
        "tau_list": tau_list,
        "graphs_per_N": graphs_per_N,
        "runs_per_N": runs_per_N,
        "burnin_N": args.burnin,
        "sample_N": args.sample,
        "reintroduce": reintroduce,
        "master_seed": master_seed,
        "bootstrap_B": B,
        "result_label": "simulated",
        "verdict": verdict,
        "tau_c_4000": s4000["tau_c_point"] if s4000 else None,
        "tau_c_4000_ci": [s4000["tau_c_ci_lo"], s4000["tau_c_ci_hi"]] if s4000 and s4000["tau_c_ci_lo"] is not None else None,
        "pass_detail": pass_detail,
        "fail_detail": fail_detail,
        "summaries": summaries,
        "runtime_s": time.time() - t0,
        "n_units": len(rows),
    }

    # Write results
    csv_path = os.path.join(results_dir, "sis_results.csv")
    fieldnames = ["N", "tau", "graph", "run", "seed", "f_mean", "f_var",
                  "absorptions", "reintroductions", "hit_absorbing", "n_events", "t"]
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    summary_path = os.path.join(results_dir, "summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nVerdict: {verdict.upper()}")
    print(f"tau_c^eff(4000) = {summary['tau_c_4000']} "
          f"(CI {summary['tau_c_4000_ci']})")
    print(f"Wrote {csv_path} and {summary_path}")
    return 0 if verdict in ("supported", "unsupported") else 0


if __name__ == "__main__":
    sys.exit(main())
