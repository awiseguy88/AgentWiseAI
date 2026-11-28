#!/usr/bin/env python3
"""Smoke test for Payne nodal line counterexample experiment."""
import csv
import json
import math
import os
import subprocess
import sys


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    run_py = os.path.join(base, "simulate.py")
    outdir = os.path.join(base, "results_smoke")

    cmd = [sys.executable, run_py, "--quick", "--output", outdir]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: simulate.py exited with error")
        return 1

    csv_path = os.path.join(outdir, "results.csv")
    summary_path = os.path.join(outdir, "summary.json")
    if not os.path.exists(csv_path) or not os.path.exists(summary_path):
        print("FAIL: missing results files (results.csv / summary.json)")
        return 1

    with open(summary_path) as f:
        summary = json.load(f)
    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    checks = []

    # 1. non-empty results
    checks.append(("Results CSV non-empty", len(rows) > 0))

    # 2. required columns present
    required = {"N", "radius", "mu_1", "min_distance_to_boundary_fine",
                "nodal_line_touches_boundary_fine", "mesh_converged", "result_label"}
    checks.append(("Required columns present",
                   rows and required.issubset(set(rows[0].keys()))))

    # 3. result_label simulated
    checks.append(("Results labeled simulated",
                   summary.get("result_label") == "simulated"))

    # 4. verdict field present and sensible
    checks.append(("Verdict field present",
                   summary.get("verdict") in ("supported", "unsupported", "inconclusive")))

    # 5. eigenvalues positive and finite
    mus = [float(r["mu_1"]) for r in rows]
    checks.append(("mu_1 positive finite",
                   all(math.isfinite(m) and m > 0.0 for m in mus)))

    # 6. boolean metric is boolean
    flags = [str(r["nodal_line_touches_boundary_fine"]).lower()
             for r in rows]
    checks.append(("Touch boolean well-formed",
                   all(f in ("true", "false") for f in flags)))

    # 7. nodal-line geometry written
    nl_dir = os.path.join(outdir, "nodal_lines")
    checks.append(("Nodal-line geometry written",
                   os.path.isdir(nl_dir) and len(os.listdir(nl_dir)) > 0))

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
