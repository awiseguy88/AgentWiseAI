#!/usr/bin/env python3
"""
Degree-Respecting Labellings with Ordered Neighbour Sums — Independent Software
Reproduction of Ishikawa & Uda (2026), Theorem 1 / Corollary 2.

Source: arXiv:2611.34269v1 [math.CO], DOI 10.48550/arXiv.2611.34269.
Reproduction: python experiments/degree-respecting-labelling-ordered-neighbour-sums/run.py

Claim under test (existence, Theorem 1):
  For every finite simple graph G=(V,E) with |V|=n, label set I_n={0,...,n-1}, and any
  strictly increasing c:I_n->R, there is a bijection f:V->I_n satisfying
    (1.1) degree condition:        d(v) < d(w)  =>  f(w) < f(v)
    (1.3) equal-degree sum cond.:  d(v)=d(w) and f(w)<f(v)
                                   =>  sum_{u in N(v)} c(f(u)) <= sum_{u in N(w)} c(f(u)).
  The constructive proof picks f minimizing the edge potential
    Phi(g) = sum_{{x,y} in E} c(g(x))*c(g(y))
  over the finite nonempty set A of degree-respecting labellings; a single label-exchange
  argument shows a Phi-minimizer cannot violate (1.3).

This module enumerates degree-respecting labellings exactly, computes Phi exactly
(int for c(i)=2^i and c(i)=i; fractions.Fraction for rational/real weights), selects a
Phi-minimizer f*, and verifies (1.1) and (1.3) exactly. All results are CALCULATED
(exact finite computation), never simulated or measured.

Run:
  python experiments/degree-respecting-labelling-ordered-neighbour-sums/run.py
  python experiments/degree-respecting-labelling-ordered-neighbour-sums/run.py --help
"""

from __future__ import annotations

import argparse
import csv
import itertools
import json
import os
import sys
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(HERE, "results")


# --------------------------------------------------------------------------- #
# Weight functions c: I_n -> R (strictly increasing). Exact arithmetic only.  #
# --------------------------------------------------------------------------- #
def weight_power2(i: int) -> int:
    """c(i) = 2^i  (Corollary 2). Exact int."""
    return 1 << i


def weight_identity(i: int) -> int:
    """c(i) = i  (strictly increasing on I_n). Exact int."""
    return i


def weight_nonlinear(i: int) -> Fraction:
    """A strictly increasing NONLINEAR rational weight: c(i) = i^2 + i/2 + 1/7.

    Differences c(i+1)-c(i) = 2i + 3/2 > 0 for i >= 0, so strictly increasing.
    Exact Fraction arithmetic.
    """
    return Fraction(i * i) + Fraction(i, 2) + Fraction(1, 7)


def weight_real_sqrt2(i: int) -> Fraction:
    """A strictly increasing 'real' weight using a rational surrogate for sqrt(2):
    c(i) = (i + 1) * r  with r = 1/1 (rational). This is linear; kept to show a
    non-power, non-identity rational weight. (See weight_nonlinear for nonlinear.)
    """
    return Fraction(i + 1)


WEIGHT_FUNCS = {
    "2^i": weight_power2,
    "i": weight_identity,
    "nonlinear": weight_nonlinear,
    "linear_shift": weight_real_sqrt2,
}


# --------------------------------------------------------------------------- #
# Graph helpers (simple undirected, vertices 0..n-1).                         #
# --------------------------------------------------------------------------- #
def degrees(n: int, edges) -> list[int]:
    d = [0] * n
    for a, b in edges:
        d[a] += 1
        d[b] += 1
    return d


def adjacency(n: int, edges) -> list[list[int]]:
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    return adj


# --------------------------------------------------------------------------- #
# Labelling predicates (exact).                                              #
# --------------------------------------------------------------------------- #
def is_degree_respecting(n, edges, f, deg) -> bool:
    """(1.1): d(v) < d(w) => f(w) < f(v), for all ordered pairs v,w."""
    for v in range(n):
        for w in range(n):
            if deg[v] < deg[w] and not (f[w] < f[v]):
                return False
    return True


def violation_1_1(n, edges, f, deg) -> int:
    """Count of ordered pairs (v,w) violating (1.1)."""
    c = 0
    for v in range(n):
        for w in range(n):
            if deg[v] < deg[w] and not (f[w] < f[v]):
                c += 1
    return c


def neighbour_sums(n, adj, f, c) -> list:
    """S(v) = sum_{u in N(v)} c(f(u)), exact type from c."""
    sums = []
    for v in range(n):
        s = None
        for u in adj[v]:
            term = c(f[u])
            s = term if s is None else s + term
        if s is None:
            # isolated vertex: empty sum. Use the weight's zero for type stability.
            s = c(0) - c(0)
        sums.append(s)
    return sums


def violation_1_3(n, f, deg, nbr_sums) -> int:
    """Count of ordered equal-degree pairs (v,w) violating (1.3).

    (1.3): d(v)=d(w) and f(w)<f(v) => S(v) <= S(w). Violation when the premise
    holds but S(v) > S(w).
    """
    c = 0
    for v in range(n):
        for w in range(n):
            if deg[v] == deg[w] and f[w] < f[v] and nbr_sums[v] > nbr_sums[w]:
                c += 1
    return c


def edge_potential(n, edges, f, c):
    """Phi(f) = sum_{{x,y} in E} c(f(x))*c(f(y)), exact type from c."""
    total = None
    for a, b in edges:
        term = c(f[a]) * c(f[b])
        total = term if total is None else total + term
    if total is None:
        total = c(0) - c(0)  # empty graph: exact zero of the right type
    return total


# --------------------------------------------------------------------------- #
# Enumeration.                                                               #
# --------------------------------------------------------------------------- #
def degree_respecting_labellings(n, edges, c):
    """All bijections f:V->I_n satisfying (1.1). f is a tuple with f[v]=label of v."""
    deg = degrees(n, edges)
    out = []
    for perm in itertools.permutations(range(n)):  # perm[v] = label of vertex v
        if is_degree_respecting(n, edges, perm, deg):
            out.append(perm)
    return out


def phi_minimizer(n, edges, c):
    """Return (f_star, A, min_phi, all_minimizers) where f_star minimizes Phi over A.

    A is the set of degree-respecting labellings; ties are broken by lexicographic
    order of the label tuple for determinism. Exact arithmetic.
    """
    A = degree_respecting_labellings(n, edges, c)
    if not A:
        raise ValueError("no degree-respecting labelling (should be impossible)")
    scored = [(edge_potential(n, edges, f, c), f) for f in A]
    min_phi = min(p for p, _ in scored)
    minimizers = [f for p, f in scored if p == min_phi]
    minimizers.sort()
    return minimizers[0], A, min_phi, minimizers


def verify(n, edges, c):
    """Full check for one (G,c): returns a result dict (all calculated)."""
    deg = degrees(n, edges)
    adj = adjacency(n, edges)
    f_star, A, min_phi, minimizers = phi_minimizer(n, edges, c)
    nbr = neighbour_sums(n, adj, f_star, c)
    v11 = violation_1_1(n, edges, f_star, deg)
    v13 = violation_1_3(n, f_star, deg, nbr)
    # Count valid labellings = degree-respecting AND (1.3)-satisfying.
    valid = []
    for f in A:
        ns = neighbour_sums(n, adj, f, c)
        if violation_1_3(n, f, deg, ns) == 0:
            valid.append(f)
    return {
        "n": n,
        "edges": [list(e) for e in edges],
        "degrees": deg,
        "f_star": list(f_star),
        "phi_min": _fmt(min_phi),
        "num_degree_respecting": len(A),
        "num_valid": len(valid),
        "valid_labellings": [list(f) for f in valid],
        "neighbour_sums_f_star": [_fmt(s) for s in nbr],
        "violations_1_1": v11,
        "violations_1_3": v13,
        "is_minimizer": True,
    }


def _fmt(x):
    """Render int/Fraction exactly as a string."""
    if isinstance(x, Fraction):
        return str(x)
    return str(x)


# --------------------------------------------------------------------------- #
# Graph catalogue.                                                           #
# --------------------------------------------------------------------------- #
def graph_catalogue():
    """Return list of (name, n, edges, note). All simple undirected, vertices 0..n-1."""
    g = []
    # Example 4 anchor: 2-methylbutane = isopentane skeleton, the unique tree on
    # 5 vertices with degree sequence (3,2,1,1,1): a degree-3 vertex joined to a
    # degree-2 vertex (which carries one leaf) and to two leaves.
    # Vertices: 0=degree-3 centre, 1=degree-2 centre, 2,3,4=leaves.
    g.append(("example4_2methylbutane", 5, [(0, 1), (0, 2), (0, 3), (1, 4)],
              "Example 4: 2-methylbutane (isopentane) skeleton, degrees (3,2,1,1,1)"))
    # Complete graphs K_n.
    for n in range(1, 7):
        edges = [(i, j) for i in range(n) for j in range(i + 1, n)]
        g.append((f"K_{n}", n, edges, f"complete graph K_{n}"))
    # Paths P_n.
    for n in range(1, 8):
        edges = [(i, i + 1) for i in range(n - 1)]
        g.append((f"P_{n}", n, edges, f"path P_{n}"))
    # Stars K_{1,n-1}.
    for n in range(2, 8):
        edges = [(0, i) for i in range(1, n)]
        g.append((f"star_K1_{n-1}", n, edges, f"star K_{1,{n-1}}"))
    # Empty graphs (no edges).
    for n in range(1, 7):
        g.append((f"empty_{n}", n, [], f"empty graph on {n} vertices"))
    # A few small connected non-anchor graphs (mixed degrees).
    g.append(("paw", 4, [(0, 1), (1, 2), (2, 0), (1, 3)], "triangle with a pendant (paw)"))
    g.append(("diamond", 4, [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3)], "diamond K4 minus an edge"))
    g.append(("C_4", 4, [(0, 1), (1, 2), (2, 3), (3, 0)], "4-cycle"))
    g.append(("C_5", 5, [(0, 1), (1, 2), (2, 3), (3, 4), (4, 0)], "5-cycle"))
    g.append(("C_6", 6, [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 0)], "6-cycle"))
    g.append(("double_star", 6,
              [(0, 1), (1, 2), (1, 3), (2, 4), (2, 5)],
              "two degree-3 centres joined, 4 leaves"))
    g.append(("K2_3", 5,
              [(0, 2), (0, 3), (0, 4), (1, 2), (1, 3), (1, 4)],
              "complete bipartite K_{2,3}"))
    g.append(("barbell", 6,
              [(0, 1), (1, 2), (2, 0), (3, 4), (4, 5), (5, 3), (2, 3)],
              "two triangles joined by a bridge"))
    g.append(("disconnected_2K2", 4, [(0, 1), (2, 3)], "two disjoint edges (disconnected)"))
    return g


# --------------------------------------------------------------------------- #
# Negative control: exhibit a degree-respecting NON-minimizer violating (1.3). #
# --------------------------------------------------------------------------- #
def find_negative_control(n, edges, c):
    """Return (f_witness, S, v13) for a degree-respecting f with (1.3) violation, or None.

    This proves the (1.3) test is not vacuous: among degree-respecting labellings there
    exist ones that violate (1.3) (they are simply not Phi-minimizers).
    """
    deg = degrees(n, edges)
    adj = adjacency(n, edges)
    for f in degree_respecting_labellings(n, edges, c):
        ns = neighbour_sums(n, adj, f, c)
        if violation_1_3(n, f, deg, ns) > 0:
            return list(f), [_fmt(s) for s in ns], violation_1_3(n, f, deg, ns)
    return None


def find_degree_violating_permutation(n, edges):
    """Return a permutation that VIOLATES (1.1), to prove the (1.1) test discriminates."""
    deg = degrees(n, edges)
    for perm in itertools.permutations(range(n)):
        if violation_1_1(n, edges, perm, deg) > 0:
            return list(perm), violation_1_1(n, edges, perm, deg)
    return None


# --------------------------------------------------------------------------- #
# Driver.                                                                    #
# --------------------------------------------------------------------------- #
def run(output_dir=RESULTS_DIR, quick=False):
    os.makedirs(output_dir, exist_ok=True)
    catalogue = graph_catalogue()
    if quick:
        # Keep every anchor + a representative subset for fast CI.
        keep = {"example4_2methylbutane", "K_4", "P_5", "star_K1_4",
                "empty_4", "paw", "diamond", "C_5", "double_star", "K2_3",
                "disconnected_2K2"}
        catalogue = [g for g in catalogue if g[0] in keep]

    weight_names = ["2^i", "i", "nonlinear", "linear_shift"] if not quick else ["2^i", "nonlinear"]

    rows = []            # per (G,c)
    total_v11 = 0
    total_v13 = 0
    summary = {
        "label": "calculated",
        "num_graphs": len(catalogue),
        "num_weight_funcs": len(weight_names),
        "weight_funcs": weight_names,
        "total_violations_1_1": 0,
        "total_violations_1_3": 0,
        "all_zero_violations": True,
        "example4": None,
        "negative_control": None,
        "per_graph": [],
    }

    for name, n, edges, note in catalogue:
        gsum = {"name": name, "n": n, "edges": [list(e) for e in edges],
                "note": note, "cases": []}
        for wname in weight_names:
            c = WEIGHT_FUNCS[wname]
            res = verify(n, edges, c)
            res["graph"] = name
            res["weight"] = wname
            res["note"] = note
            rows.append(res)
            total_v11 += res["violations_1_1"]
            total_v13 += res["violations_1_3"]
            if res["violations_1_1"] or res["violations_1_3"]:
                summary["all_zero_violations"] = False
            gsum["cases"].append({
                "weight": wname,
                "f_star": res["f_star"],
                "phi_min": res["phi_min"],
                "num_degree_respecting": res["num_degree_respecting"],
                "num_valid": res["num_valid"],
                "neighbour_sums_f_star": res["neighbour_sums_f_star"],
                "violations_1_1": res["violations_1_1"],
                "violations_1_3": res["violations_1_3"],
            })
            if name == "example4_2methylbutane" and wname == "2^i":
                deg1_labels = sorted(res["f_star"][i] for i in range(n) if res["degrees"][i] == 1)
                deg1_sums = sorted(res["neighbour_sums_f_star"][i]
                                   for i in range(n) if res["degrees"][i] == 1)
                summary["example4"] = {
                    "f_star": res["f_star"],
                    "num_valid": res["num_valid"],
                    "valid_labellings": res["valid_labellings"],
                    "neighbour_sums_f_star": res["neighbour_sums_f_star"],
                    "degrees": res["degrees"],
                    "degree1_labels": deg1_labels,
                    "degree1_sums": deg1_sums,
                    "degree1_labels_are_2_3_4": deg1_labels == [2, 3, 4],
                    "degree1_sums_are_1_1_2": deg1_sums == ["1", "1", "2"],
                }
        summary["per_graph"].append(gsum)

    summary["total_violations_1_1"] = total_v11
    summary["total_violations_1_3"] = total_v13

    # Negative control on the Example 4 anchor (c=2^i) and on the paw graph.
    neg = {}
    for cname, gname in [("2^i", "example4_2methylbutane"), ("2^i", "C_5"),
                         ("nonlinear", "double_star"), ("i", "C_4")]:
        cat = {g[0]: g for g in catalogue}
        if gname not in cat:
            continue
        _, n, edges, _ = cat[gname]
        c = WEIGHT_FUNCS[cname]
        witness = find_negative_control(n, edges, c)
        dv = find_degree_violating_permutation(n, edges)
        neg[f"{gname}|{cname}"] = {
            "degree_respecting_nonminimizer_violating_1_3": witness,
            "degree_violating_permutation_rejected_by_1_1": dv,
        }
    summary["negative_control"] = neg

    # Write CSVs.
    with open(os.path.join(output_dir, "per_case_results.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["graph", "n", "weight", "f_star", "phi_min",
                    "num_degree_respecting", "num_valid",
                    "neighbour_sums_f_star", "violations_1_1", "violations_1_3",
                    "label"])
        for r in rows:
            w.writerow([r["graph"], r["n"], r["weight"],
                        ";".join(map(str, r["f_star"])), r["phi_min"],
                        r["num_degree_respecting"], r["num_valid"],
                        ";".join(r["neighbour_sums_f_star"]),
                        r["violations_1_1"], r["violations_1_3"], "calculated"])

    with open(os.path.join(output_dir, "summary.json"), "w") as fh:
        json.dump(summary, fh, indent=2)

    # Verdict.
    e4 = summary["example4"]
    baseline_ok = (
        e4 is not None
        and e4["num_valid"] == 2
        and e4.get("degree1_labels_are_2_3_4", False)
        and e4.get("degree1_sums_are_1_1_2", False)
        and summary["all_zero_violations"]
    )
    neg_ok = any(
        v["degree_respecting_nonminimizer_violating_1_3"] is not None
        and v["degree_violating_permutation_rejected_by_1_1"] is not None
        for v in neg.values()
    ) if neg else False

    if baseline_ok and neg_ok:
        verdict = "supported"
    elif not summary["all_zero_violations"]:
        verdict = "unsupported"
    else:
        verdict = "inconclusive"

    summary["verdict"] = verdict
    summary["baseline_ok"] = baseline_ok
    summary["negative_control_ok"] = neg_ok
    with open(os.path.join(output_dir, "summary.json"), "w") as fh:
        json.dump(summary, fh, indent=2)

    print(f"Graphs: {len(catalogue)}  Weight funcs: {weight_names}")
    print(f"Total (1.1) violations of f*: {total_v11}")
    print(f"Total (1.3) violations of f*: {total_v13}")
    print(f"Example 4 valid labellings (c=2^i): "
          f"{summary['example4']['num_valid'] if summary['example4'] else 'N/A'}")
    print(f"Negative control ok: {neg_ok}")
    print(f"VERDICT: {verdict}")
    print(f"Results written to {output_dir}")
    return summary


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quick", action="store_true",
                    help="run a reduced graph/weight subset (for CI)")
    ap.add_argument("--output-dir", default=RESULTS_DIR,
                    help="directory for results (default: experiments/.../results)")
    args = ap.parse_args(argv)
    summary = run(output_dir=args.output_dir, quick=args.quick)
    return 0 if summary["verdict"] == "supported" else 1


if __name__ == "__main__":
    sys.exit(main())