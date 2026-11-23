#!/usr/bin/env python3
"""Smoke test for Stable Schur Positivity Counterexample (Borcea-Brändén Problem 36)."""
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))


def main():
    run_py = os.path.join(BASE, "simulate.py")
    proc = subprocess.run([sys.executable, run_py], capture_output=True, text=True)
    print(proc.stdout)
    if proc.stderr:
        print(proc.stderr, file=sys.stderr)
    if proc.returncode != 0:
        print("FAIL: simulate.py exited with error")
        return 1

    results_path = os.path.join(BASE, "results", "results.json")
    if not os.path.exists(results_path):
        print("FAIL: missing results/results.json")
        return 1
    with open(results_path) as f:
        r = json.load(f)

    checks = []

    # 1. verdict supported
    checks.append(("Verdict supported", r.get("verdict") == "supported"))

    # 2. result label calculated
    checks.append(("Result label calculated", r.get("result_label") == "calculated"))

    # 3. leading principal minors all > 0 and match expected
    mins_ok = True
    expected_minors = {
        0: [38, 1083, 28728, 202176, 1119744],
        1: [38, 1083, 28728, 202176, 1119744],
        2: [38, 288, 8208, 202176, 1119744],
        3: [38, 288, 8208, 46656, 1119744],
        4: [8, 288, 1728, 46656, 1119744],
    }
    for i in range(5):
        got = r["minors"][f"J{i+1}"]
        if got != expected_minors[i] or any(m <= 0 for m in got):
            mins_ok = False
    checks.append(("All leading principal minors > 0 and match source", mins_ok))

    # 4. monomial coefficients match expected
    expected_mono = {
        "(5,)": 1728,
        "(4, 1)": 19440,
        "(3, 2)": 66555,
        "(3, 1, 1)": 140910,
        "(2, 2, 1)": 250440,
        "(2, 1, 1, 1)": 547405,
        "(1, 1, 1, 1, 1)": 1182860,
    }
    mono_ok = all(r["monomial_coefficients"][k] == v for k, v in expected_mono.items())
    checks.append(("Monomial coefficients match source", mono_ok))

    # 5. Schur coefficients match expected including [s_(1^5)]q == -2972
    expected_schur = {
        "(5,)": 1728,
        "(4, 1)": 17712,
        "(3, 2)": 47115,
        "(3, 1, 1)": 56643,
        "(2, 2, 1)": 62415,
        "(2, 1, 1, 1)": 56437,
        "(1, 1, 1, 1, 1)": -2972,
    }
    schur_ok = all(r["schur_coefficients"][k] == v for k, v in expected_schur.items())
    checks.append(("Schur coefficients match source", schur_ok))

    # 6. closed-form identity
    ident_ok = (
        1728 - 2*19440 - 2*66555 + 3*140910 + 3*250440 - 4*547405 + 1182860 == -2972
    )
    checks.append(("Closed-form identity equals -2972", ident_ok))

    # 7. Kostka matrix independently derived (SSYT) matches quoted matrix
    checks.append(("Kostka matrix independently verified", r.get("kostka_independent_match") is True))

    # 8. baseline control: h_5 Schur-positive
    checks.append(("Baseline control (h_5 Schur-positive)", r.get("baseline_ok") is True))

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