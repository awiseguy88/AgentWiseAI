#!/usr/bin/env python3
"""
Woodward Mach Effect Thruster — Numerical Verification.

Reproduction: python3 experiments/woodward-mach-effect-thruster/simulate.py

Numerical evaluation of Woodward's transient mass fluctuation equation:

    delta_m = (1 / (4 * pi * G)) * (V / c^2) * (d^2E/dt^2)_max
    F_pred  = delta_m * a

with sinusoidal energy variation E(t) = E0 * sin(omega * t), so
|d^2E/dt^2|_max = E0 * omega^2, omega = 2 * pi * f, f = 2.2 MHz.

All computations are performed in software only (Python + NumPy). No physical
measurement, hardware, or real-world data collection is involved. Results are
labeled "calculated" (direct numerical evaluation of Woodward's equation).

Sweep (per issue #161):
    V       in [0.1, 10] cm^3   (capacitor volume)
    E0      in [0.01, 10] J     (peak stored energy)
    a       in [1e3, 1e7] m/s^2 (synchronous mechanical acceleration)
    f       = 2.2e6 Hz          (March & Palfreyman 2006)

Constants: G = 6.674e-11 m^3/kg/s^2, c = 2.998e8 m/s.

Outputs results/woodward_results.csv with columns:
    V_cm3, E0_J, a_mps2, f_Hz, delta_m_kg, F_pred_N, result_label
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

# Physical constants (Woodward 1990 / March & Palfreyman 2006 conventions)
G = 6.674e-11  # m^3 / kg / s^2
C = 2.998e8  # m / s
FREQ_HZ = 2.2e6  # Hz (March & Palfreyman 2006)

# Verdict thresholds (issue #161), in Newtons
SUPPORT_THRESHOLD_N = 0.3e-3  # F_pred >= 0.3 mN -> supported
UNSUPPORT_THRESHOLD_N = 0.03e-3  # F_pred < 0.03 mN for all -> unsupported

RESULT_LABEL = "calculated"

DEFAULT_V_CM3 = [0.1, 10.0]  # cm^3
DEFAULT_E0_J = [0.01, 10.0]  # J
DEFAULT_A_MPS2 = [1e3, 1e7]  # m/s^2


def compute_delta_m(v_m3: float | np.ndarray, e0_j: float | np.ndarray) -> np.ndarray:
    """Transient mass fluctuation delta_m = (1/4piG) * (V/c^2) * (d2E/dt2)_max.

    With E(t) = E0 sin(omega t): |d2E/dt2|_max = E0 * omega^2.
    """
    omega = 2.0 * math.pi * FREQ_HZ
    d2e_dt2_max = np.asarray(e0_j, dtype=np.float64) * omega ** 2
    v_over_c2 = np.asarray(v_m3, dtype=np.float64) / C ** 2
    return (1.0 / (4.0 * math.pi * G)) * v_over_c2 * d2e_dt2_max


def compute_thrust(delta_m_kg: np.ndarray, a_mps2: np.ndarray) -> np.ndarray:
    """Predicted peak thrust F_pred = delta_m * a (N)."""
    return np.asarray(delta_m_kg, dtype=np.float64) * np.asarray(a_mps2, dtype=np.float64)


def sweep(v_cm3_list, e0_j_list, a_mps2_list):
    """Vectorized parameter sweep over (V, E0, a). Returns list of result rows."""
    v_m3 = np.asarray(v_cm3_list, dtype=np.float64) * 1e-6  # cm^3 -> m^3
    e0 = np.asarray(e0_j_list, dtype=np.float64)
    a = np.asarray(a_mps2_list, dtype=np.float64)

    V, E0, A = np.meshgrid(v_m3, e0, a, indexing="ij")
    V = V.ravel()
    E0 = E0.ravel()
    A = A.ravel()

    delta_m = compute_delta_m(V, E0)
    f_pred = compute_thrust(delta_m, A)

    rows = []
    # Build full combination rows (every grid point).
    v_cm3_full = V * 1e6  # back to cm^3 for reporting
    for i in range(V.size):
        rows.append({
            "V_cm3": float(v_cm3_full[i]),
            "E0_J": float(E0[i]),
            "a_mps2": float(A[i]),
            "f_Hz": float(FREQ_HZ),
            "delta_m_kg": float(delta_m[i]),
            "F_pred_N": float(f_pred[i]),
            "result_label": RESULT_LABEL,
        })
    return rows


def verdict_from_sweep(rows):
    """supported / unsupported / inconclusive per issue #161 thresholds."""
    f_preds = np.array([r["F_pred_N"] for r in rows], dtype=np.float64)
    f_max = float(np.max(f_preds))
    f_min = float(np.min(f_preds))
    n_above_support = int(np.count_nonzero(f_preds >= SUPPORT_THRESHOLD_N))
    n_below_unsupport = int(np.count_nonzero(f_preds < UNSUPPORT_THRESHOLD_N))
    if n_above_support > 0:
        verdict = "supported"
    elif n_below_unsupport == len(rows):
        verdict = "unsupported"
    else:
        verdict = "inconclusive"
    return verdict, f_max, f_min, n_above_support, n_below_unsupport


def main():
    ap = argparse.ArgumentParser(
        description="Woodward Mach Effect Thruster numerical verification sweep.")
    ap.add_argument("--V", type=str, default=",".join(map(str, DEFAULT_V_CM3)),
                    help="comma-separated V grid endpoints in cm^3 (min,max)")
    ap.add_argument("--E0", type=str, default=",".join(map(str, DEFAULT_E0_J)),
                    help="comma-separated E0 grid endpoints in J (min,max)")
    ap.add_argument("--a", type=str, default=",".join(map(str, DEFAULT_A_MPS2)),
                    help="comma-separated a grid endpoints in m/s^2 (min,max)")
    ap.add_argument("--points", type=int, default=10,
                    help="number of log-spaced points per axis")
    ap.add_argument("--output", type=str, default=None,
                    help="results directory (default: results/ next to this file)")
    args = ap.parse_args()

    def parse_endpoints(s, default):
        parts = [float(x) for x in s.split(",")]
        if len(parts) == 1:
            parts = [parts[0], parts[0]]
        if len(parts) != 2:
            print("FAIL: each axis needs one or two comma-separated endpoints", file=sys.stderr)
            return 2
        return parts

    v_lo, v_hi = parse_endpoints(args.V, DEFAULT_V_CM3)
    e0_lo, e0_hi = parse_endpoints(args.E0, DEFAULT_E0_J)
    a_lo, a_hi = parse_endpoints(args.a, DEFAULT_A_MPS2)

    if min(v_lo, v_hi) <= 0 or min(e0_lo, e0_hi) <= 0 or min(a_lo, a_hi) <= 0:
        print("FAIL: all sweep endpoints must be positive (log-spaced grid)", file=sys.stderr)
        return 2

    v_list = np.logspace(math.log10(min(v_lo, v_hi)), math.log10(max(v_lo, v_hi)), args.points)
    e0_list = np.logspace(math.log10(min(e0_lo, e0_hi)), math.log10(max(e0_lo, e0_hi)), args.points)
    a_list = np.logspace(math.log10(min(a_lo, a_hi)), math.log10(max(a_lo, a_hi)), args.points)

    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = args.output or os.path.join(base, "results")
    os.makedirs(results_dir, exist_ok=True)

    t0 = time.time()
    rows = sweep(v_list, e0_list, a_list)
    verdict, f_max, f_min, n_support, n_unsupport = verdict_from_sweep(rows)
    runtime_s = time.time() - t0

    summary = {
        "experiment": "woodward-mach-effect-thruster",
        "issue": 161,
        "result_label": RESULT_LABEL,
        "verdict": verdict,
        "constants": {"G": G, "c": C, "f_Hz": FREQ_HZ},
        "sweep": {
            "V_cm3": [float(v_list.min()), float(v_list.max())],
            "E0_J": [float(e0_list.min()), float(e0_list.max())],
            "a_mps2": [float(a_list.min()), float(a_list.max())],
            "points_per_axis": args.points,
            "n_combinations": len(rows),
        },
        "thresholds_N": {
            "supported": SUPPORT_THRESHOLD_N,
            "unsupported": UNSUPPORT_THRESHOLD_N,
        },
        "verdict_detail": {
            "F_pred_max_N": f_max,
            "F_pred_min_N": f_min,
            "n_combinations_ge_support_threshold": n_support,
            "n_combinations_lt_unsupport_threshold": n_unsupport,
        },
        "runtime_s": runtime_s,
    }

    csv_path = os.path.join(results_dir, "woodward_results.csv")
    fieldnames = ["V_cm3", "E0_J", "a_mps2", "f_Hz", "delta_m_kg", "F_pred_N", "result_label"]
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    summary_path = os.path.join(results_dir, "summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Woodward MLT numerical verification: {len(rows)} combinations "
          f"(V {v_list.min():g}–{v_list.max():g} cm^3, E0 {e0_list.min():g}–{e0_list.max():g} J, "
          f"a {a_list.min():g}–{a_list.max():g} m/s^2, f = {FREQ_HZ:g} Hz)")
    print(f"  delta_m range: {np.min([r['delta_m_kg'] for r in rows]):.6e} – "
          f"{np.max([r['delta_m_kg'] for r in rows]):.6e} kg")
    print(f"  F_pred range: {f_min:.6e} – {f_max:.6e} N")
    print(f"  combinations >= {SUPPORT_THRESHOLD_N} N (0.3 mN): {n_support}")
    print(f"  combinations < {UNSUPPORT_THRESHOLD_N} N (0.03 mN): {n_unsupport}")
    print(f"  Verdict: {verdict.upper()}  (runtime {runtime_s:.3f}s)")
    print(f"Wrote {csv_path} and {summary_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
