#!/usr/bin/env python3
"""Smoke test for E-Sail Thrust Scaling Exponent experiment."""
import json
import os
import subprocess
import sys


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    proc = subprocess.run([sys.executable, os.path.join(base, "run.py")],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: run.py exited with error")
        return 1
    summary_path = os.path.join(base, "results", "summary.json")
    csv_path = os.path.join(base, "results", "e-sail-thrust-scaling.csv")
    if not (os.path.exists(summary_path) and os.path.exists(csv_path)):
        print("FAIL: missing results files")
        return 1
    with open(summary_path) as f:
        summary = json.load(f)

    checks = []
    # 1. result label calculated
    checks.append(("Result label calculated", summary.get("result_label") == "calculated"))
    # 2. verdict supported
    checks.append(("Verdict supported", summary.get("verdict") == "supported"))
    # 3. baseline alpha within tolerance
    base = next(c for c in summary["cases"] if c["case"] == "baseline_fixed_b_eff")
    checks.append(("Baseline alpha in 2.00 +/- 0.01", abs(base["alpha"] - 2.00) <= 0.01))
    # 4. isothermal alpha within tolerance
    iso = next(c for c in summary["cases"] if c["case"].startswith("sheath_beta_beta_0.0000"))
    checks.append(("Isothermal alpha in 1.00 +/- 0.02", abs(iso["alpha"] - 1.00) <= 0.02))
    # 5. beta=1/3 within 5% of 7/6
    target = 7.0 / 6.0
    mid = next(c for c in summary["cases"] if c["case"].startswith("sheath_beta_beta_1_over_3"))
    checks.append(("beta=1/3 alpha within 5% of 7/6",
                   abs(mid["alpha"] - target) / target <= 0.05))
    # 6. monotonic in beta within [1.0, 1.35]
    betas = sorted([c for c in summary["cases"]
                   if c["beta"] is not None and c["b_max_m"] is None], key=lambda c: c["beta"])
    alphas = [c["alpha"] for c in betas]
    checks.append(("Monotonic and in [1.00, 1.35]",
                   all(alphas[i] < alphas[i + 1] for i in range(len(alphas) - 1))
                   and all(1.00 <= a <= 1.35 for a in alphas)))
    # 7. CSV has rows
    with open(csv_path) as f:
        lines = f.read().strip().splitlines()
    checks.append(("CSV has data rows", len(lines) > 1))

    passed = 0
    for name, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'}: {name}")
        if ok:
            passed += 1
    print(f"{passed}/{len(checks)} checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())