#!/usr/bin/env python3
"""Smoke test for the order-7 Lyapunov symmetric-maximizer counterexample.

Runs simulate.py and checks the exact integer identities and n <= 5 controls.
"""
import json
import os
import subprocess
import sys

import numpy as np


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    sim_py = os.path.join(base, "simulate.py")

    # Run simulate.py.
    proc = subprocess.run([sys.executable, sim_py], capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: simulate.py exited with error")
        return 1

    out_path = os.path.join(base, "results", "output.json")
    if not os.path.exists(out_path):
        print("FAIL: missing results/output.json")
        return 1

    with open(out_path) as f:
        r = json.load(f)

    checks = []

    # 1. exact integer identities.
    checks.append(("||K||_F^2 == 53836", r["K_frobenius_squared"] == 53836))
    checks.append(("||L_A(K)||_F^2 == 64387950", r["L_A_K_frobenius_squared"] == 64387950))

    # 2. skew ratio > 1196.
    checks.append(("ratio 64387950/53836 > 1196", r["skew_ratio"]["numerator"] / r["skew_ratio"]["denominator"] > 1196))

    # 3. K is exactly skew-symmetric.
    checks.append(("K is skew-symmetric", r["K_is_skew_symmetric"] is True))

    # 4. symmetric max eigenvalue < 1196 (float64 control).
    checks.append(("symmetric max eigenvalue < 1196", r["symmetric_max_eigenvalue_float64"] < 1196))
    checks.append(("symmetric max eigenvalue ~1195.593985",
                   abs(r["symmetric_max_eigenvalue_float64"] - 1195.593985) < 1e-3))

    # 5. skew max eigenvalue > 1196 (float64 control).
    checks.append(("skew max eigenvalue > 1196", r["skew_max_eigenvalue_float64"] > 1196))
    checks.append(("skew max eigenvalue ~1196.025224",
                   abs(r["skew_max_eigenvalue_float64"] - 1196.025224) < 1e-3))

    # 6. exact certificate M_S positive definite with pivots >= 82.
    checks.append(("M_S positive definite", r["M_S_positive_definite"] is True))
    checks.append(("28 LDL^T pivots", r["certificate_num_pivots"] == 28))
    checks.append(("all pivots >= 82", r["certificate_all_pivots_ge_82"] is True))

    # 7. n <= 5 controls: conjecture holds (skew <= sym).
    checks.append(("n<=5 controls: skew <= sym",
                   r["controls_all_skew_le_sym"] is True))

    # 8. verdict supported.
    checks.append(("verdict == supported", r["verdict"] == "supported"))

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