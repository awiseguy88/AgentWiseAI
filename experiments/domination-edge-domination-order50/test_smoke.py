#!/usr/bin/env python3
"""Smoke test for the 50-vertex cubic domination counterexample experiment."""
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))


def main():
    # Run the reproduction command from the experiment directory.
    proc = subprocess.run(
        [sys.executable, os.path.join(BASE, "simulate.py")],
        capture_output=True, text=True, cwd=BASE,
    )
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        print("FAIL: simulate.py exited with error")
        return 1

    res_path = os.path.join(BASE, "results", "verification.txt")
    if not os.path.exists(res_path):
        print("FAIL: missing results/verification.txt")
        return 1

    with open(os.path.join(BASE, "counterexample.json"), encoding="utf-8") as f:
        d = json.load(f)
    n = d["n"]
    edges = [tuple(e) for e in d["edges"]]
    adj = [set() for _ in range(n)]
    for u, v in edges:
        adj[u].add(v)
        adj[v].add(u)

    checks = []

    # 1. graph is cubic on 50 vertices
    checks.append(("Cubic 50-vertex graph", n == 50 and all(len(a) == 3 for a in adj)))

    # 2. witness D0 dominates
    D0 = d["dominating_witness_16"]
    dominated = set(D0)
    for v in D0:
        dominated.update(adj[v])
    checks.append(("D0 of size 16 dominates all 50 vertices",
                   len(D0) == 16 and len(dominated) == n))

    # 3. matching M of size 15 is maximal
    M = [tuple(e) for e in d["pair_matching"]]
    used = set()
    for u, v in M:
        used |= {u, v}
    unmatched = set(range(n)) - used
    maximal = not any(v in adj[u] for u in unmatched for v in unmatched if u < v)
    checks.append(("Matching M of size 15 is maximal",
                   len(M) == 15 and maximal))

    # 4. edgelist matches json edges
    with open(os.path.join(BASE, "counterexample.edgelist"), encoding="utf-8") as f:
        el = []
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                el.append(tuple(sorted(map(int, line.split()))))
    checks.append(("edgelist matches json edges",
                   sorted(el) == sorted(tuple(sorted(e)) for e in edges)))

    # 5. results file mentions the key invariants
    with open(res_path, encoding="utf-8") as f:
        text = f.read()
    checks.append(("results mention gamma=16", "gamma(G) = 16" in text))
    checks.append(("results mention gamma_e=15", "gamma_e(G) = 15" in text))
    checks.append(("results mention 1048576 subsets", "1048576" in text))
    checks.append(("results mention 5931 residual", "5931" in text))

    # 6. smoke re-runs quickly (already ran above); verdict present
    checks.append(("VERIFIED line present", "VERIFIED: every dominating set has size at least 16" in text))

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