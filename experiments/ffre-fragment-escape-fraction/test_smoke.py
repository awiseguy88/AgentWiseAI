#!/usr/bin/env python3
"""Smoke test for FFRE Fission Fragment Escape Fraction experiment.

Verifies the simulation runs from a clean checkout and produces non-empty,
well-formed results with required columns R/L, f_escape, effective_Isp.
"""

import csv
import os
import subprocess
import sys


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    proc = subprocess.run([sys.executable, os.path.join(base, "simulate.py")],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: simulate.py exited with error")
        return 1

    csv_path = os.path.join(base, "results", "ffre-escape-fraction.csv")
    if not os.path.exists(csv_path):
        print("FAIL: missing results CSV")
        return 1

    checks = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    checks.append(("simulate.py exits 0", proc.returncode == 0))
    checks.append(("CSV has required columns R/L, f_escape, effective_Isp",
                   {"R/L", "f_escape", "effective_Isp"}.issubset(set(fieldnames))))
    checks.append(("CSV has data rows", len(rows) > 0))
    checks.append(("every row labeled calculated or simulated",
                   all(row.get("method") in ("calculated", "simulated") for row in rows)))
    checks.append(("f_escape in [0, 1] for every row",
                   all(0.0 <= float(row["f_escape"]) <= 1.0 for row in rows)))
    checks.append(("effective_Isp == f_escape * 1,000,000 s (simulated rows)",
                   all(abs(float(row["effective_Isp"]) - float(row["f_escape"]) * 1e6) <= 1e-3
                       for row in rows if row.get("method") == "simulated")))
    checks.append(("MC standard error < 1% for every simulated row (stop condition)",
                   all(float(row["se"]) < 0.01
                       for row in rows
                       if row.get("method") == "simulated" and row.get("se", ""))))
    checks.append(("at least one calculated reference row present",
                   any(row.get("method") == "calculated" for row in rows)))

    passed = 0
    for name, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'}: {name}")
        if ok:
            passed += 1
    print(f"{passed}/{len(checks)} checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
