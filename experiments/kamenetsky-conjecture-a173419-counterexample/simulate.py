#!/usr/bin/env python3
"""
simulate.py — Exhaustive verification of Kamenetsky's conjecture counterexample
at p = 3359 on OEIS A173419.

OEIS A173419: a(n) is the length of the shortest computation yielding n using
addition, subtraction, and multiplication, starting from x_0 = 1; each x_k is
x_i + x_j, x_i * x_j, or x_i - x_j for some 0 <= i, j < k; chains may reuse
earlier entries. Only positive results are kept. All arithmetic is on Python
integers (exact, no floating point).

Kamenetsky's conjecture (OEIS comment, Dec 2019): a(p) >= a(p-1) for every
prime p; noted to hold for all primes p < 1800. Patanè (2026, arXiv:2609.28512)
disproves it at p = 3359: chain 1,2,4,16,15,225,3375,3359 gives a(3359) <= 7,
while a(3358) >= 8.

This script (Python standard library only):
  1. Validates the explicit upper-bound chains step by step
     (calculated results).
  2. Exhaustively enumerates ALL chains up to a fixed depth (simulated results)
     and records, for every value, the minimum depth at which it is reachable.
  3. Recomputes a(1)..a(108) by exhaustive enumeration and compares them with
     the published OEIS b-file values (baseline control).
  4. Writes raw output to results/ and prints a summary.

Threshold (PASS): exhaustive search confirms a(3359) = 7 (no chain of length
<= 6) AND a(3358) = 8 (no chain of length <= 7, explicit length-8 chain valid)
=> a(3359) < a(3358), conjecture falsified at p = 3359.

Reproduction: python3 simulate.py
"""

from __future__ import annotations

import csv
import json
import os
import sys
import time
from typing import Dict, List, Optional, Sequence, Set, Tuple

MAX_DEPTH = 8

# Published OEIS A173419 b-file values a(1)..a(108) (reference control).
# Embedded so the experiment runs fully offline (standard library only).
OEIS_A1_108: List[int] = [0, 1, 2, 2, 3, 3, 4, 3, 3, 4, 4, 4, 5, 4, 4, 3, 4, 4, 5, 4, 5, 5, 5, 4, 4, 5, 4, 5, 5, 5, 5, 4, 5, 5, 5, 4, 5, 5, 5, 5, 6, 5, 6, 6, 5, 6, 6, 5, 5, 5, 6, 6, 6, 5, 6, 5, 6, 6, 6, 5, 6, 5, 5, 4, 5, 5, 6, 5, 6, 6, 6, 5, 6, 6, 5, 6, 6, 5, 5, 5, 4, 5, 5, 5, 6, 6, 6, 6, 6, 5, 6, 6, 6, 6, 6, 5, 6, 6, 5, 5, 6, 6, 6, 6, 6, 6, 6, 5]

CHAIN_3359: List[int] = [1, 2, 4, 16, 15, 225, 3375, 3359]      # 7 operations
CHAIN_3358: List[int] = [1, 2, 4, 16, 15, 17, 225, 3375, 3358]  # 8 operations

TARGETS = (3358, 3359)


def chain_is_valid(chain: Sequence[int]) -> Tuple[bool, Optional[str]]:
    """Validate an explicit chain step by step.

    Each entry x_k (k >= 1) must equal x_i + x_j, x_i * x_j, or x_i - x_j
    for some 0 <= i, j < k; results must be positive; x_0 must be 1.
    Returns (ok, reason).
    """
    if not chain or chain[0] != 1:
        return False, "chain must start with x_0 = 1"
    for k in range(1, len(chain)):
        v = chain[k]
        prev = chain[:k]
        ok = any(
            v == x + y or v == x * y or v == x - y
            for x in prev for y in prev
        )
        if not ok or v <= 0:
            return False, (
                f"x_{k} = {v} is not obtainable from two earlier entries "
                f"{prev} by +, -, or *"
            )
    return True, None


def enumerate_to_depth(max_depth: int) -> Tuple[Dict[int, int], List[dict]]:
    """
    Exhaustive enumeration of all chains up to max_depth.

    State: sets of values S = {x_0, ..., x_d} (frozensets) with x_0 = 1 where
    every member beyond 1 was derived from two earlier members. Transition:
    S -> S | {v} for v = a + b, a * b, or b - a with a, b in S, v > 0,
    v not in S. This explores every chain exactly; no value cap is applied,
    so the enumeration is exact (finite because each step adds one new entry).

    Returns:
      best: dict value -> minimum depth at which the value is reachable.
      stats: per-depth list of dicts with set counts and newly reached values.
    """
    best: Dict[int, int] = {1: 0}
    stats: List[dict] = []
    levels: Set[frozenset] = {frozenset([1])}

    for d in range(1, max_depth + 1):
        t0 = time.time()
        nxt: Set[frozenset] = set()
        new_values: Set[int] = set()
        final = d == max_depth  # no need to build the next level at the end
        for S in levels:
            vals = sorted(S)
            nvals = len(vals)
            for i in range(nvals):
                a = vals[i]
                for j in range(i, nvals):
                    b = vals[j]
                    for v in (a + b, a * b, b - a):
                        if v <= 0 or v in S:
                            continue
                        if v not in best:
                            best[v] = d
                            new_values.add(v)
                        if not final:
                            nxt.add(S | {v})
        levels = nxt
        elapsed = time.time() - t0
        stats.append({
            "depth": d,
            "chain_sets": len(levels),
            "new_values": len(new_values),
            "new_values_list": sorted(new_values),
            "elapsed_seconds": round(elapsed, 4),
        })
        print(
            f"|F_{d}| = {len(levels):,}  new values at depth {d}: {len(new_values):,}  "
            f"({elapsed:.2f}s)"
        )
        if not levels and d < max_depth:
            print("Enumeration exhausted: no chains extend further.")
            break
    return best, stats


def write_reachable_per_depth(stats: List[dict], outdir: str) -> str:
    path = os.path.join(outdir, "reachable_per_depth.txt")
    with open(path, "w") as f:
        f.write("Exhaustive chain enumeration: operation counts per depth\n")
        f.write("======================================================\n")
        f.write("Depth = number of operations (+, -, *) from x_0 = 1.\n")
        f.write("Each row reports the number of distinct chain value-sets\n")
        f.write("at that depth and the values first reached exactly there.\n\n")
        for s in stats:
            f.write(f"depth {s['depth']}: chain_sets = {s['chain_sets']:,}, "
                    f"new_values = {s['new_values']:,}, "
                    f"elapsed = {s['elapsed_seconds']}s\n")
            for v in s["new_values_list"]:
                if v in TARGETS or v <= 200:
                    f.write(f"  first reached at depth {s['depth']}: {v}\n")
            if s["new_values"] > 0:
                small = [v for v in s["new_values_list"] if v <= 200 and v not in TARGETS]
                if small:
                    f.write(f"  newly reachable (<= 200): {small}\n")
        f.write(f"\nTargets tracked: {TARGETS}\n")
    return path


def write_a1_108(best: Dict[int, int], outdir: str) -> str:
    path = os.path.join(outdir, "a1_108.csv")
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["n", "recomputed_a(n)", "oeis_a(n)", "match"])
        for n in range(1, 109):
            oeis = OEIS_A1_108[n - 1]
            computed = best.get(n)
            match = computed == oeis
            writer.writerow([n, computed if computed is not None else "unreachable<=8",
                             oeis, "yes" if match else "NO"])
    return path


def write_bounds_summary(best: Dict[int, int], stats: List[dict],
                         chain_results: dict, outdir: str) -> str:
    summary = {
        "experiment": "kamenetsky-conjecture-a173419-counterexample",
        "max_depth": MAX_DEPTH,
        "chain_validation": chain_results,
        "exhaustive_bounds": {
            "a_3359_upper_bound_explicit_chain_length": len(CHAIN_3359) - 1,
            "a_3359_not_reachable_at_depth_le_6": best.get(3359, 99) > 6,
            "a_3358_not_reachable_at_depth_le_7": best.get(3358, 99) > 7,
            "a_3358_min_depth_enumeration": best.get(3358),
            "a_3359_min_depth_enumeration": best.get(3359),
        },
        "oeis_control": {
            "checked": "a(1)..a(108)",
            "matches_oeis_exactly": all(
                best.get(n) == OEIS_A1_108[n - 1] for n in range(1, 109)
            ),
            "mismatches": [
                n for n in range(1, 109)
                if best.get(n) != OEIS_A1_108[n - 1]
            ],
        },
        "verdict": None,  # filled by main after evaluating thresholds
    }
    ap = best.get(3359)
    am = best.get(3358)
    chain_3359_ok = chain_results["chain_3359"]["valid"]
    chain_3358_ok = chain_results["chain_3358"]["valid"]
    lower_3359 = ap is not None and ap > 6   # not reachable at depth <= 6
    lower_3358 = am is not None and am > 7   # not reachable at depth <= 7
    upper_3359 = chain_3359_ok               # explicit chain -> a(3359) <= 7
    upper_3358 = chain_3358_ok               # explicit chain -> a(3358) <= 8
    pass_ = (lower_3359 and upper_3359 and lower_3358 and upper_3358)
    summary["verdict"] = "supported" if pass_ else ("failed" if not pass_ else "inconclusive")
    summary["a_3359"] = ap if ap is not None else "unreachable at depth <= 8"
    summary["a_3358"] = am if am is not None else "unreachable at depth <= 8"
    summary["conjecture_falsified"] = bool(pass_)
    summary["threshold_pass"] = bool(pass_)
    path = os.path.join(outdir, "bounds_summary.json")
    with open(path, "w") as f:
        json.dump(summary, f, indent=2)
        f.write("\n")
    return path


def main() -> int:
    base = os.path.dirname(os.path.abspath(__file__))
    outdir = os.path.join(base, "results")
    os.makedirs(outdir, exist_ok=True)

    print(f"=== Kamenetsky's conjecture counterexample: p = 3359 (OEIS A173419) ===")
    print(f"Exhaustive chain enumeration to depth {MAX_DEPTH} (standard library only)\n")

    # 1. Validate explicit chains (calculated results).
    ok3359, why3359 = chain_is_valid(CHAIN_3359)
    ok3358, why3358 = chain_is_valid(CHAIN_3358)
    chain_results = {
        "chain_3359": {
            "chain": list(CHAIN_3359),
            "operations": len(CHAIN_3359) - 1,
            "valid": ok3359,
            "reason": why3359,
            "label": "calculated",
        },
        "chain_3358": {
            "chain": list(CHAIN_3358),
            "operations": len(CHAIN_3358) - 1,
            "valid": ok3358,
            "reason": why3358,
            "label": "calculated",
        },
    }
    print("Explicit chain validation (calculated):")
    print(f"  3359: {CHAIN_3359} -> {len(CHAIN_3359)-1} operations, valid = {ok3359}"
          + (f" ({why3359})" if not ok3359 else ""))
    print(f"  3358: {CHAIN_3358} -> {len(CHAIN_3358)-1} operations, valid = {ok3358}"
          + (f" ({why3358})" if not ok3358 else ""))

    if not (ok3359 and ok3358):
        print("ABORT: an explicit chain is invalid; cannot establish upper bounds.")
        return 1

    # 2. Exhaustive enumeration (simulated results).
    best, stats = enumerate_to_depth(MAX_DEPTH)

    # 3. Baseline control: a(1)..a(108) vs OEIS.
    mismatches = [n for n in range(1, 109) if best.get(n) != OEIS_A1_108[n - 1]]
    oeis_ok = not mismatches
    print("\nBaseline control a(1)..a(108) vs OEIS A173419:")
    print(f"  match = {oeis_ok}" + (f"; mismatches at {mismatches}" if mismatches else ""))
    if not oeis_ok:
        print("ABORT: baseline OEIS check failed; enumeration cannot be trusted.")
        return 1

    ap = best.get(3359)
    am = best.get(3358)
    print("\nExhaustive search results (simulated):")
    print(f"  a(3359): min depth = {ap}; reachable at depth <= 6: "
          f"{ap is not None and ap <= 6}")
    print(f"  a(3358): min depth = {am}; reachable at depth <= 7: "
          f"{am is not None and am <= 7}")

    # 4. Write raw results.
    write_reachable_per_depth(stats, outdir)
    write_a1_108(best, outdir)
    write_bounds_summary(best, stats, chain_results, outdir)

    # 5. Threshold evaluation.
    lower_3359 = ap is not None and ap > 6
    lower_3358 = am is not None and am > 7
    upper_3359 = ok3359   # explicit length-7 chain => a(3359) <= 7
    upper_3358 = ok3358   # explicit length-8 chain => a(3358) <= 8
    pass_ = lower_3359 and upper_3359 and lower_3358 and upper_3358

    print("\n=== Threshold ===")
    print(f"  a(3359) = 7 (no chain <= 6, explicit length-7 chain): {lower_3359 and upper_3359}")
    print(f"  a(3358) = 8 (no chain <= 7, explicit length-8 chain): {lower_3358 and upper_3358}")
    print(f"  a(3359) < a(3358): {7 if upper_3359 else '?'} < "
          f"{8 if upper_3358 else '?'} -> {pass_}")
    print(f"  Verdict: {'PASS (conjecture falsified at p = 3359)' if pass_ else 'FAIL/INCONCLUSIVE'}")
    print(f"\nResults written to: {outdir}")
    return 0 if pass_ else 1


if __name__ == "__main__":
    sys.exit(main())
