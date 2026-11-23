#!/usr/bin/env python3
"""Smoke test for isolated-hadamard-defect-counterexample experiment."""
import json
import os
import subprocess
import sys


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    sim = os.path.join(base, "simulate.py")

    proc = subprocess.run([sys.executable, sim], capture_output=True, text=True)
    print(proc.stdout)
    if proc.stderr:
        print(proc.stderr, file=sys.stderr)
    if proc.returncode != 0:
        print("FAIL: simulate.py exited with error")
        return 1

    inv_path = os.path.join(base, "results", "invariants.json")
    hm_path = os.path.join(base, "results", "H_matrix.txt")
    ct_path = os.path.join(base, "results", "control_table.txt")
    if not os.path.exists(inv_path) or not os.path.exists(hm_path) or not os.path.exists(ct_path):
        print("FAIL: missing results files")
        return 1

    with open(inv_path) as f:
        inv = json.load(f)

    h = inv["H"]
    fctl = inv["Fourier_control"]
    b = inv["booleans"]

    checks = [
        ("simulate.py exit 0", proc.returncode == 0),
        ("results/invariants.json present", True),
        ("results/H_matrix.txt present", True),
        ("results/control_table.txt present", True),
        ("isHadamard TRUE", h["isHadamard"] is True),
        ("maxdev HH* < 1e-8", h["maxdev_HHstar"] < 1e-8),
        ("d(H) == 1", h["d_H"] == 1),
        ("dim_C[P,Q] == 143", h["dim_C_PQ"] == 143),
        ("(n-1)^2 == 144", h["n_minus_1_squared"] == 144),
        ("spanFails TRUE", h["spanFails"] is True),
        ("O_H(R0) ~= -168/169", abs(h["O_H_R0"]["real"] + 168 / 169) < 1e-9),
        ("O_H(R0) != 0", h["secondOrderBlocks"] is True),
        ("Fourier control d == 0", fctl["d_F"] == 0),
        ("Fourier control dim_C[P,Q] == 144", fctl["dim_C_PQ"] == 144),
        ("Verdict supported", inv["verdict"] == "supported"),
        ("Result label calculated", inv["result_label"] == "calculated"),
    ]
    for name, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'}: {name}")
    passed = sum(1 for _, ok in checks if ok)
    print(f"{passed}/{len(checks)} checks passed")
    print("SMOKE_OK" if passed == len(checks) else "SMOKE_FAIL")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
