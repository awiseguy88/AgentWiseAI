#!/usr/bin/env python3
"""Smoke test for the Kamenetsky counterexample experiment (issue #167).

Runs simulate.py and checks that all required results exist, the OEIS control
matches exactly, the exhaustive bounds give a(3359) = 7 and a(3358) = 8,
and the explicit chain validator accepts/rejects chains correctly.
"""
import csv
import json
import os
import subprocess
import sys


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    simulate_py = os.path.join(base, "simulate.py")
    results_dir = os.path.join(base, "results")

    checks = []

    # 1. Reproduction command runs clean.
    proc = subprocess.run([sys.executable, simulate_py], capture_output=True, text=True)
    checks.append(("python3 simulate.py exits 0", proc.returncode == 0))
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)

    # 2. Required result artifacts exist.
    for name in ["reachable_per_depth.txt", "a1_108.csv", "bounds_summary.json"]:
        checks.append((f"results/{name} exists",
                       os.path.exists(os.path.join(results_dir, name))))

    # 3. a(1)..a(108) matches the published OEIS b-file exactly.
    with open(os.path.join(results_dir, "a1_108.csv"), newline="") as f:
        rows = list(csv.DictReader(f))
    checks.append(("a1_108.csv has 108 rows", len(rows) == 108))
    checks.append(("all a(1)..a(108) match OEIS",
                   all(r["match"] == "yes" for r in rows)))

    # 4. Exhaustive bounds and verdict.
    with open(os.path.join(results_dir, "bounds_summary.json")) as f:
        summary = json.load(f)
    checks.append(("a(3359) == 7", summary["a_3359"] == 7))
    checks.append(("a(3358) == 8", summary["a_3358"] == 8))
    checks.append(("no chain <= 6 for 3359",
                   summary["exhaustive_bounds"]["a_3359_not_reachable_at_depth_le_6"] is True))
    checks.append(("no chain <= 7 for 3358",
                   summary["exhaustive_bounds"]["a_3358_not_reachable_at_depth_le_7"] is True))
    checks.append(("OEIS control matches exactly",
                   summary["oeis_control"]["matches_oeis_exactly"] is True))
    checks.append(("threshold pass", summary["threshold_pass"] is True))
    checks.append(("verdict supported", summary["verdict"] == "supported"))

    # 5. Chain validator unit checks.
    sys.path.insert(0, base)
    import simulate  # noqa: E402
    ok, _ = simulate.chain_is_valid([1, 2, 4, 16, 15, 225, 3375, 3359])
    checks.append(("explicit 3359 chain (len 7) validates", ok))
    ok, _ = simulate.chain_is_valid([1, 2, 4, 16, 15, 17, 225, 3375, 3358])
    checks.append(("explicit 3358 chain (len 8) validates", ok))
    ok, _ = simulate.chain_is_valid([1, 3])
    checks.append(("invalid chain [1, 3] rejected", not ok))

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
