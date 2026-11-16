#!/usr/bin/env python3
"""Smoke test for SIS epidemic threshold finite-size experiment."""
import csv
import json
import os
import subprocess
import sys

import numpy as np


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    run_py = os.path.join(base, "run.py")
    outdir = os.path.join(base, "results_smoke")

    # Minimal run: small N, few taus/graphs/runs, short windows.
    cmd = [
        sys.executable, run_py,
        "--N", "500",
        "--tau-list", "0.30,0.38,0.45,0.55,0.70",
        "--graphs", "3",
        "--runs", "2",
        "--burnin", "3",
        "--sample", "8",
        "--bootstrap", "50",
        "--seed", "4242",
        "--output", outdir,
        "--no-plot",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: run.py exited with error")
        return 1

    csv_path = os.path.join(outdir, "sis_results.csv")
    summary_path = os.path.join(outdir, "summary.json")
    if not os.path.exists(csv_path) or not os.path.exists(summary_path):
        print("FAIL: missing results files (sis_results.csv / summary.json)")
        return 1

    with open(summary_path) as f:
        summary = json.load(f)
    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    checks = []

    # 1. expected row count
    expected = 5 * 3 * 2
    checks.append(("Row count == 30", len(rows) == expected))

    # 2. f_mean in [0,1]
    fmeans = [float(r["f_mean"]) for r in rows]
    checks.append(("All f_mean in [0,1]", all(0.0 <= x <= 1.0 for x in fmeans)))

    # 3. reintroduction happened at low tau (absorbing state common)
    low_tau_rows = [r for r in rows if float(r["tau"]) == 0.30]
    reintro_low = sum(int(r["reintroductions"]) for r in low_tau_rows)
    checks.append(("Absorbing-state reintroduction observed at tau=0.30", reintro_low > 0))

    # 4. prevalence increases with tau on average (coarse monotonicity)
    by_tau = {}
    for r in rows:
        by_tau.setdefault(float(r["tau"]), []).append(float(r["f_mean"]))
    tau_vals = sorted(by_tau)
    mean_by_tau = [float(np.mean(by_tau[t])) for t in tau_vals]
    # last should be clearly above first
    checks.append(("Mean prevalence higher at tau=0.70 than tau=0.30",
                   mean_by_tau[-1] > mean_by_tau[0] + 0.02))

    # 5. verdict field present and sensible
    checks.append(("Verdict field present",
                   summary.get("verdict") in ("supported", "unsupported", "inconclusive")))

    # 6. result labeled simulated
    checks.append(("Results labeled simulated", summary.get("result_label") == "simulated"))

    # 7. tau_c estimated for N=500 (or reported)
    s500 = next((s for s in summary.get("summaries", []) if s.get("N") == 500), None)
    checks.append(("N=500 summary present", s500 is not None))

    passed = 0
    for name, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'}: {name}")
        if ok:
            passed += 1
    print(f"{passed}/{len(checks)} checks passed")
    print("SMOKE_OK" if passed == len(checks) else "SMOKE_FAIL")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
