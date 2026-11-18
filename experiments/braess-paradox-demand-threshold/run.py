#!/usr/bin/env python3
"""
Braess Paradox Demand Threshold Verification (calculated/simulated).

Reproduction: python experiments/braess-paradox-demand-threshold/run.py
"""
from __future__ import annotations

import csv
import math
import os
from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np
from scipy.optimize import minimize

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MPL = True
except Exception:
    HAS_MPL = False


# Standard Braess network parameters (travel time units)
# Edges: SA: f, AT: 50, SB: 50, BT: f, AB: ab_cost
STANDARD = {
    "SA_a": 1.0, "SA_b": 0.0,
    "AT_a": 0.0, "AT_b": 50.0,
    "SB_a": 0.0, "SB_b": 50.0,
    "BT_a": 1.0, "BT_b": 0.0,
    "AB_a": 0.0, "AB_b": 1.0,
}


@dataclass
class EqResult:
    demand: float
    total_cost: float
    edge_flows: Dict[str, float]
    path_flows: Dict[str, float]
    method: str  # "calculated" (analytical) or "simulated" (numerical)
    success: bool
    message: str = ""


def total_cost_from_edges(flows: Dict[str, float], params: Dict[str, float]) -> float:
    cost = 0.0
    for e in ["SA", "AT", "SB", "BT", "AB"]:
        f = flows.get(e, 0.0)
        a = params[f"{e}_a"]
        b = params[f"{e}_b"]
        cost += f * (a * f + b)
    return cost


def analytical_no_edge(D: float, params: Dict[str, float] = STANDARD) -> EqResult:
    """Calculated (analytical): two parallel paths S-A-T and S-B-T."""
    # Symmetric for standard params; solve generally for affine.
    # path1: SA + AT = a_SA*x + b_SA + a_AT*x + b_AT
    # path2: SB + BT = a_SB*(D-x) + b_SB + a_BT*(D-x) + b_BT
    # equilibrium: path1 == path2 or boundary
    A1 = params["SA_a"] + params["AT_a"]
    B1 = params["SA_b"] + params["AT_b"]
    A2 = params["SB_a"] + params["BT_a"]
    B2 = params["SB_b"] + params["BT_b"]
    # A1*x + B1 = A2*(D-x) + B2 -> x*(A1+A2) = A2*D + B2 - B1
    denom = A1 + A2
    if abs(denom) < 1e-12:
        x = D / 2.0
    else:
        x = (A2 * D + B2 - B1) / denom
    x = max(0.0, min(D, x))
    y = D - x
    flows = {"SA": x, "AT": x, "SB": y, "BT": y, "AB": 0.0}
    # if boundary, adjust (not needed for standard symmetric case in range)
    tc = total_cost_from_edges(flows, params)
    return EqResult(D, tc, flows, {"S-A-T": x, "S-B-T": y}, "calculated", True)


def analytical_with_edge_standard(D: float) -> EqResult:
    """Calculated (analytical) for standard Braess network only."""
    # Standard: c_SA=f, c_AT=50, c_SB=50, c_BT=f, c_AB=1
    # Three paths: P1 S-A-T (x1), P2 S-A-B-T (x2), P3 S-B-T (x3), sum D
    # Costs: C1 = (x1+x2)+50, C2 = (x1+x2)+1+(x2+x3), C3 = 50+(x2+x3)
    # Wardrop equilibrium cases by demand:
    if D <= 0:
        flows = {"SA": 0.0, "AT": 0.0, "SB": 0.0, "BT": 0.0, "AB": 0.0}
        return EqResult(D, 0.0, flows, {"S-A-T": 0.0, "S-A-B-T": 0.0, "S-B-T": 0.0}, "calculated", True)

    # Case A: all three used when C1=C2=C3 feasible with all > 0
    # C1=C2 => 50 = 1 + x2 + x3 => x2+x3 = 49
    # C2=C3 => x1+x2 + 1 = 50 => x1+x2 = 49
    # and x1+x2+x3 = D => 49 + x3 = D? from x1+x2=49 => x3=D-49; from x2+x3=49 => x1=D-49
    # x2 = D - x1 - x3 = D - 2*(D-49) = 98 - D
    # all > 0 => D>49 and D<98
    if 49 < D < 98:
        x1 = D - 49
        x3 = D - 49
        x2 = 98 - D
    elif D <= 49:
        # P2 best when cheap? compare costs: try P2 only? C2 = D+1+D=2D+1 vs P1,P3 at split.
        # For small D, path P2: S-A (D)+A-B(1)+B-T(D)=2D+1. P1 alone 50+D. P2 better if 2D+1 < 50+D => D<49.
        # But also check if P1,P3 unused at equilibrium: cost P1 with x1=0,x2=D = D+50 vs 2D+1 => equal at 49.
        x1 = 0.0
        x2 = D
        x3 = 0.0
    else:  # D >= 98
        # AB not used: back to two paths, split equally
        x1 = D / 2.0
        x2 = 0.0
        x3 = D / 2.0

    SA = x1 + x2
    AT = x1
    SB = x3
    BT = x2 + x3
    AB = x2
    flows = {"SA": SA, "AT": AT, "SB": SB, "BT": BT, "AB": AB}
    tc = total_cost_from_edges(flows, STANDARD)
    return EqResult(D, tc, flows, {"S-A-T": x1, "S-A-B-T": x2, "S-B-T": x3}, "calculated", True)


def beckmann_objective(edge_vars: np.ndarray, edges: List[str], params: Dict[str, float]) -> float:
    # edge_vars in order of edges: integral a/2*f^2 + b*f
    val = 0.0
    for f, e in zip(edge_vars, edges):
        a = params[f"{e}_a"]
        b = params[f"{e}_b"]
        val += 0.5 * a * f * f + b * f
    return float(val)


def numerical_with_edge(D: float, params: Dict[str, float] = STANDARD) -> EqResult:
    """Simulated (numerical): Wardrop equilibrium via Beckmann potential minimization."""
    # Path flow variables x1 (S-A-T), x2 (S-A-B-T), x3 (S-B-T)
    def obj(x):
        x1, x2, x3 = x
        SA, AT, SB, BT, AB = x1 + x2, x1, x3, x2 + x3, x2
        flows = {"SA": SA, "AT": AT, "SB": SB, "BT": BT, "AB": AB}
        return beckmann_objective(np.array([SA, AT, SB, BT, AB]), ["SA", "AT", "SB", "BT", "AB"], params)

    cons = ({"type": "eq", "fun": lambda x: x[0] + x[1] + x[2] - D},)
    bounds = [(0.0, D), (0.0, D), (0.0, D)]
    x0 = np.array([D / 3.0, D / 3.0, D / 3.0])
    res = minimize(obj, x0, method="SLSQP", bounds=bounds, constraints=cons,
                   options={"ftol": 1e-12, "maxiter": 1000})
    x = np.maximum(res.x, 0.0)
    s = x.sum()
    if s > 0:
        x = x * (D / s)
    x1, x2, x3 = float(x[0]), float(x[1]), float(x[2])
    flows = {"SA": x1 + x2, "AT": x1, "SB": x3, "BT": x2 + x3, "AB": x2}
    tc = total_cost_from_edges(flows, params)
    return EqResult(D, tc, flows, {"S-A-T": x1, "S-A-B-T": x2, "S-B-T": x3}, "simulated", bool(res.success), str(res.message))


def numerical_no_edge(D: float, params: Dict[str, float] = STANDARD) -> EqResult:
    """Simulated (numerical) without AB edge."""
    def obj(x):
        x1, x3 = x  # S-A-T, S-B-T
        SA, AT, SB, BT = x1, x1, x3, x3
        flows = {"SA": SA, "AT": AT, "SB": SB, "BT": BT, "AB": 0.0}
        return beckmann_objective(np.array([SA, AT, SB, BT, 0.0]), ["SA", "AT", "SB", "BT", "AB"], params)

    cons = ({"type": "eq", "fun": lambda x: x[0] + x[1] - D},)
    bounds = [(0.0, D), (0.0, D)]
    x0 = np.array([D / 2.0, D / 2.0])
    res = minimize(obj, x0, method="SLSQP", bounds=bounds, constraints=cons,
                   options={"ftol": 1e-12, "maxiter": 1000})
    x = np.maximum(res.x, 0.0)
    s = x.sum()
    if s > 0:
        x = x * (D / s)
    x1, x3 = float(x[0]), float(x[1])
    flows = {"SA": x1, "AT": x1, "SB": x3, "BT": x3, "AB": 0.0}
    tc = total_cost_from_edges(flows, params)
    return EqResult(D, tc, flows, {"S-A-T": x1, "S-B-T": x3}, "simulated", bool(res.success), str(res.message))


def find_critical_demand(demands: List[float], costs_no: List[float], costs_with: List[float]) -> float | None:
    """Find D* where cost_with crosses cost_no (interpolated). Return first crossing where with becomes > no."""
    for i in range(len(demands) - 1):
        d0, d1 = demands[i], demands[i + 1]
        diff0 = costs_with[i] - costs_no[i]
        diff1 = costs_with[i + 1] - costs_no[i + 1]
        # crossing from <=0 to >0 (paradox onset)
        if diff0 <= 0 and diff1 > 0:
            if abs(diff1 - diff0) < 1e-12:
                return d1
            t = -diff0 / (diff1 - diff0)
            return d0 + t * (d1 - d0)
    return None


def find_paradox_vanish(demands: List[float], costs_no: List[float], costs_with: List[float]) -> float | None:
    """Find D where paradox vanishes (with <= no) after being in paradox."""
    in_paradox = False
    for i in range(len(demands) - 1):
        diff0 = costs_with[i] - costs_no[i]
        diff1 = costs_with[i + 1] - costs_no[i + 1]
        if diff0 > 1e-9:
            in_paradox = True
        if in_paradox and diff1 <= 1e-9:
            d0, d1 = demands[i], demands[i + 1]
            if abs(diff1 - diff0) < 1e-12:
                return d1
            t = -diff0 / (diff1 - diff0)
            return d0 + t * (d1 - d0)
    return None


def run_sweep(params: Dict[str, float], label: str, outdir: str, use_analytical_with: bool = False) -> dict:
    demands = list(range(1, 151))
    rows = []
    cno_list, cwith_list = [], []
    conv_fail = 0
    for D in demands:
        no = numerical_no_edge(D, params)
        if use_analytical_with and params == STANDARD:
            wi_an = analytical_with_edge_standard(D)
            wi = numerical_with_edge(D, params)  # also compute numerical for comparison
            # use analytical as "calculated" primary in separate columns? store both
            cno_an = analytical_no_edge(D, params)
            cost_no = cno_an.total_cost
            cost_with = wi_an.total_cost
            method_with = wi_an.method
            method_no = cno_an.method
            num_cost_with = wi.total_cost
            num_cost_no = no.total_cost
            if not wi.success:
                conv_fail += 1
        else:
            wi = numerical_with_edge(D, params)
            cost_no = no.total_cost
            cost_with = wi.total_cost
            method_with = wi.method
            method_no = no.method
            num_cost_with = cost_with
            num_cost_no = cost_no
            cno_an = None
            wi_an = None
            if not wi.success or not no.success:
                conv_fail += 1

        paradox = cost_with > cost_no + 1e-9
        cno_list.append(cost_no)
        cwith_list.append(cost_with)
        row = {
            "demand": D,
            "cost_no_edge": cost_no,
            "cost_with_edge": cost_with,
            "cost_diff_with_minus_no": cost_with - cost_no,
            "paradox": int(paradox),
            "method_no_edge": method_no,
            "method_with_edge": method_with,
            "ab_flow": wi_an.edge_flows["AB"] if wi_an else wi.edge_flows.get("AB", 0.0),
            "num_cost_no_edge": num_cost_no,
            "num_cost_with_edge": num_cost_with,
            "num_success_with_edge": int(wi.success),
        }
        rows.append(row)

    csv_path = os.path.join(outdir, f"results_{label}.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    D_star = find_critical_demand(demands, cno_list, cwith_list)
    D_vanish = find_paradox_vanish(demands, cno_list, cwith_list)
    return {
        "label": label,
        "csv": csv_path,
        "demands": demands,
        "costs_no": cno_list,
        "costs_with": cwith_list,
        "D_star": D_star,
        "D_vanish": D_vanish,
        "conv_fail": conv_fail,
        "total": len(demands),
    }


def save_plot(sweeps: List[dict], outpath: str):
    if not HAS_MPL:
        return False
    plt.figure(figsize=(10, 6))
    for sw in sweeps:
        if sw["label"] != "standard":
            continue
        plt.plot(sw["demands"], sw["costs_no"], label="Without A→B edge (calculated)", linewidth=2)
        plt.plot(sw["demands"], sw["costs_with"], label="With A→B edge (calculated)", linewidth=2)
        if sw["D_star"] is not None:
            plt.axvline(sw["D_star"], color="red", linestyle="--", alpha=0.7, label=f'Paradox onset D*≈{sw["D_star"]:.4f}')
        if sw["D_vanish"] is not None:
            plt.axvline(sw["D_vanish"], color="green", linestyle=":", alpha=0.7, label=f'Paradox vanishes D≈{sw["D_vanish"]:.4f}')
    plt.xlabel("Demand D (vehicles per unit time)")
    plt.ylabel("Total travel cost at Wardrop equilibrium (cost units)")
    plt.title("Braess Paradox: Total Cost vs Demand (Standard Network, calculated/simulated)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(outpath, dpi=150)
    plt.close()
    return True


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    outdir = os.path.join(base, "results")
    os.makedirs(outdir, exist_ok=True)

    sweeps = []
    # Standard network: use analytical (calculated) for primary comparison
    sw_std = run_sweep(STANDARD, "standard", outdir, use_analytical_with=True)
    sweeps.append(sw_std)

    # Sensitivity: AB edge cost b parameter
    sens_ab = []
    for ab_b in [0.5, 1.0, 2.0, 5.0]:
        p = dict(STANDARD)
        p["AB_b"] = float(ab_b)
        sw = run_sweep(p, f"sens_ab_cost_{ab_b}", outdir, use_analytical_with=False)
        sens_ab.append({"AB_b": ab_b, "D_star": sw["D_star"], "D_vanish": sw["D_vanish"], "conv_fail": sw["conv_fail"]})
        sweeps.append(sw)

    # Sensitivity: constant travel time (AT/SB b parameter)
    sens_const = []
    for const_b in [30.0, 50.0, 70.0]:
        p = dict(STANDARD)
        p["AT_b"] = float(const_b)
        p["SB_b"] = float(const_b)
        sw = run_sweep(p, f"sens_const_{int(const_b)}", outdir, use_analytical_with=False)
        sens_const.append({"const_b": const_b, "D_star": sw["D_star"], "D_vanish": sw["D_vanish"], "conv_fail": sw["conv_fail"]})
        sweeps.append(sw)

    # Analytical vs numerical agreement on standard network
    agree_rows = []
    max_rel_err = 0.0
    for D in range(1, 151):
        an_no = analytical_no_edge(D, STANDARD)
        an_wi = analytical_with_edge_standard(D)
        nu_no = numerical_no_edge(D, STANDARD)
        nu_wi = numerical_with_edge(D, STANDARD)
        for name, a, n in [("no_edge", an_no.total_cost, nu_no.total_cost),
                           ("with_edge", an_wi.total_cost, nu_wi.total_cost)]:
            denom = max(abs(a), 1e-12)
            rel = abs(a - n) / denom
            max_rel_err = max(max_rel_err, rel)
            if D in (1, 20, 33, 50, 80, 98, 120, 150):
                agree_rows.append({"demand": D, "case": name, "analytical_calculated": a,
                                   "numerical_simulated": n, "abs_err": abs(a - n), "rel_err": rel})
    agree_path = os.path.join(outdir, "analytical_vs_numerical.csv")
    with open(agree_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["demand", "case", "analytical_calculated", "numerical_simulated", "abs_err", "rel_err"])
        writer.writeheader()
        writer.writerows(agree_rows)

    plot_path = os.path.join(outdir, "cost_vs_demand.png")
    plotted = save_plot([sw_std], plot_path)

    summary = {
        "standard_D_star": sw_std["D_star"],
        "standard_D_vanish": sw_std["D_vanish"],
        "standard_conv_fail": sw_std["conv_fail"],
        "max_rel_err_analytical_vs_numerical": max_rel_err,
        "agreement_within_5pct": max_rel_err <= 0.05,
        "sens_ab": sens_ab,
        "sens_const": sens_const,
        "plot": plot_path if plotted else None,
    }
    summary_path = os.path.join(outdir, "summary.csv")
    with open(summary_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "value"])
        for k, v in summary.items():
            writer.writerow([k, v])

    print("=== Braess Paradox Demand Threshold (calculated/simulated) ===")
    print(f"Standard D* (paradox onset): {sw_std['D_star']}")
    print(f"Standard D vanish (H2): {sw_std['D_vanish']}")
    print(f"Analytical target D*=98/3: {98/3}")
    if sw_std['D_star'] is not None:
        print(f"D* within 5% of 98/3: {abs(sw_std['D_star'] - 98/3) / (98/3) <= 0.05}")
    print(f"Max relative error analytical vs numerical: {max_rel_err}")
    print(f"Agreement within 5%: {max_rel_err <= 0.05}")
    print(f"Solver convergence failures (standard, numerical with-edge): {sw_std['conv_fail']}/{sw_std['total']}")
    print(f"Sensitivity AB cost: {sens_ab}")
    print(f"Sensitivity constant cost: {sens_const}")
    print(f"Results written to: {outdir}")
    return summary


if __name__ == "__main__":
    main()
