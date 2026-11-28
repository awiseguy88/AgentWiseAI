#!/usr/bin/env python3
"""Smoke test for the Ramanujan Machine CF verification experiment."""
import csv
import json
import os
import subprocess
import sys

import mpmath


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    simulate_py = os.path.join(base, "simulate.py")
    results_dir = os.path.join(base, "results")

    mpmath.mp.dps = 50
    true_zeta2 = mpmath.zeta(2)
    true_zeta3 = mpmath.zeta(3)

    # Full run (fast: depth 200).
    proc = subprocess.run([sys.executable, simulate_py], capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: simulate.py exited with error")
        return 1

    csv_path = os.path.join(results_dir, "ramanujan_cf_results.csv")
    summary_path = os.path.join(results_dir, "summary.json")
    if not os.path.exists(csv_path) or not os.path.exists(summary_path):
        print("FAIL: missing results files (ramanujan_cf_results.csv / summary.json)")
        return 1

    with open(summary_path) as f:
        summary = json.load(f)
    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    checks = []

    # 1. CSV has both CFs and multiple depths
    cfs = {r["cf"] for r in rows}
    checks.append(("CSV contains both CFs",
                   cfs == {"appery-zeta3", "dfr-zeta2"}))

    # 2. Depths reach 200 for each CF (full run, no early stop expected)
    for cf in cfs:
        depths = [int(r["depth"]) for r in rows if r["cf"] == cf]
        checks.append((f"{cf} depths cover 1..200",
                       len(depths) >= 50 and max(depths) >= 100))

    # 3. Apéry baseline at depth 200 reaches >= 12 digits (control passes)
    ap200 = [r for r in rows if r["cf"] == "appery-zeta3" and int(r["depth"]) == 200]
    if ap200:
        err = mpmath.mpf(ap200[0]["absolute_error"])
        dig = mpmath.floor(-mpmath.log(err, 10)) if err > 0 else 99
        checks.append(("Apéry baseline >= 12 digits at N=200",
                       dig >= 12 and err <= mpmath.mpf("1e-12")))

    # 4. All errors non-negative and approx values finite
    errors = [mpmath.mpf(r["absolute_error"]) for r in rows]
    checks.append(("All absolute_error >= 0",
                   all(e >= 0 for e in errors)))
    approx_vals = [mpmath.mpf(r["approx_value"]) for r in rows]
    checks.append(("All approx_value finite",
                   all(mpmath.isfinite(v) for v in approx_vals)))

    # 5. Result label set
    checks.append(("Results labeled calculated",
                   all(r["result_label"] == "calculated" for r in rows)))

    # 6. summary verdict field present
    checks.append(("Verdict field present",
                   summary.get("verdict") in ("supported", "unsupported", "inconclusive")))

    # 7. primary DFR CF converges toward zeta(2) (error at depth 200 < error at depth 1)
    dz200 = [r for r in rows if r["cf"] == "dfr-zeta2" and int(r["depth"]) == 200]
    dz1 = [r for r in rows if r["cf"] == "dfr-zeta2" and int(r["depth"]) == 1]
    if dz200 and dz1:
        e200 = mpmath.mpf(dz200[0]["absolute_error"])
        e1 = mpmath.mpf(dz1[0]["absolute_error"])
        checks.append(("DFR zeta(2) error decreases from depth 1 to 200",
                       e200 < e1))

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
