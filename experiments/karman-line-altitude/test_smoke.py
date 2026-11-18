#!/usr/bin/env python3
"""Smoke test for Kármán Line Altitude experiment."""
import json
import os
import subprocess
import sys


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    # run experiment
    proc = subprocess.run([sys.executable, os.path.join(base, "run.py")], capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: run.py exited with error")
        return 1
    summary_path = os.path.join(base, "results", "summary.json")
    csv_path = os.path.join(base, "results", "karman_results.csv")
    if not os.path.exists(summary_path) or not os.path.exists(csv_path):
        print("FAIL: missing results files")
        return 1
    with open(summary_path) as f:
        summary = json.load(f)
    with open(csv_path) as f:
        lines = f.read().strip().splitlines()

    checks = []
    # 1. smoke: W/S=2500, C_L=1.0 in [60,80] km
    # find row
    h_smoke = None
    for line in lines[1:]:
        parts = line.split(",")
        if float(parts[0]) == 2500.0 and float(parts[1]) == 1.0:
            h_smoke = float(parts[4])
            break
    checks.append(("Smoke W/S=2500 C_L=1 h in [60,80] km", h_smoke is not None and 60 <= h_smoke <= 80))
    # 2. density within 1%
    checks.append(("rho(0) within 1% of 1.225", summary.get("rho0_within_1pct") is True))
    # 3. verdict supported
    checks.append(("Verdict supported", summary.get("verdict") == "supported"))
    # 4. threshold points all in range
    checks.append(("All threshold points in [70,90] km",
                   summary.get("threshold_points_in_range") == summary.get("threshold_points")
                   and summary.get("threshold_points", 0) > 0))

    passed = 0
    for name, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'}: {name}" + (f" (h={h_smoke:.3f} km)" if name.startswith("Smoke") and h_smoke is not None else ""))
        if ok:
            passed += 1
    print(f"{passed}/{len(checks)} checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
