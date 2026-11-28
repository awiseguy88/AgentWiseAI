#!/usr/bin/env python3
"""Smoke test for Woodward Mach Effect Thruster numerical verification experiment."""
import csv
import json
import os
import subprocess
import sys

import numpy as np


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    sim_py = os.path.join(base, "simulate.py")
    outdir = os.path.join(base, "results_smoke")

    cmd = [
        sys.executable, sim_py,
        "--V", "0.1,10",
        "--E0", "0.01,10",
        "--a", "1e3,1e7",
        "--points", "5",
        "--output", outdir,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: simulate.py exited with error")
        return 1

    csv_path = os.path.join(outdir, "woodward_results.csv")
    summary_path = os.path.join(outdir, "summary.json")
    if not os.path.exists(csv_path) or not os.path.exists(summary_path):
        print("FAIL: missing results files (woodward_results.csv / summary.json)")
        return 1

    with open(summary_path) as f:
        summary = json.load(f)
    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    checks = []
    checks.append(("Row count > 0", len(rows) > 0))
    checks.append(("Expected grid size == 125", len(rows) == 5 * 5 * 5))

    v_vals = [float(r["V_cm3"]) for r in rows]
    e0_vals = [float(r["E0_J"]) for r in rows]
    a_vals = [float(r["a_mps2"]) for r in rows]
    dm_vals = [float(r["delta_m_kg"]) for r in rows]
    fp_vals = [float(r["F_pred_N"]) for r in rows]

    checks.append(("All V in [0.1, 10] cm^3", all(0.1 - 1e-9 <= x <= 10.0 + 1e-9 for x in v_vals)))
    checks.append(("All E0 in [0.01, 10] J", all(0.01 - 1e-9 <= x <= 10.0 + 1e-9 for x in e0_vals)))
    checks.append(("All a in [1e3, 1e7] m/s^2", all(1e3 - 1e-9 <= x <= 1e7 + 1e-9 for x in a_vals)))
    checks.append(("All delta_m >= 0", all(x >= 0.0 for x in dm_vals)))
    checks.append(("All F_pred >= 0", all(x >= 0.0 for x in fp_vals)))
    checks.append(("All F_pred > 0", all(x > 0.0 for x in fp_vals)))
    checks.append(("Result label calculated", all(r["result_label"] == "calculated" for r in rows)))
    checks.append(("Summary verdict present", summary.get("verdict") in ("supported", "unsupported", "inconclusive")))
    checks.append(("Summary result_label calculated", summary.get("result_label") == "calculated"))
    checks.append(("F_pred increases with a", float(np.max(fp_vals)) > float(np.min(fp_vals))))

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
