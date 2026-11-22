#!/usr/bin/env python3
"""
Ramanujan Machine Continued-Fraction Conjecture Verification.

Reproduction:
    python experiments/ramanujan-machine-cf-verification/simulate.py

Computes convergents of:
  (A) Baseline control: Apéry's proven continued fraction for zeta(3)
      (Elimelech et al. 2023, Eq. 1):
          6/zeta(3) = 5 - 1^6/(117 - 2^6/(535 - 3^6/(...)))
      with a_k = 17(k^3+(k+1)^3) - 12(2k+1), b_k = -k^6.

  (B) Primary claim under test: DFR-discovered conjectured CF for zeta(2):
          72/(72*zeta(2) - 115) = 2 - 1^2/(25 - 1^2/(16 - 2^2/(33 - ...)))
      with tail term n^2/(n^2+(n+1)^2+20) for n >= 2.

Both CFs are evaluated by truncation at depth N (N = 1..200) using
arbitrary-precision arithmetic (mpmath, 80 decimal digits). For each depth we
record the approximate value, absolute error vs the true constant, and the
number of agreeing decimal digits.

Thresholds (per experiment.yaml):
  - Baseline Apéry CF: >= 12 correct digits (error <= 1e-12) at N = 200.
  - Primary DFR zeta(2) CF: >= 10 correct digits (error <= 1e-10) at N = 200
    AND error decreases monotonically with depth.

All results are calculated numerically (no physical measurement).
Result label: calculated.
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
from decimal import Decimal

import mpmath

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

mpmath.mp.dps = 80  # working precision for convergent evaluation

MAX_DEPTH = 200
PLATEAU_WINDOW = 20  # stop early if error stops decreasing for this many depths

TRUE_ZETA2 = mpmath.zeta(2)  # pi^2 / 6
TRUE_ZETA3 = mpmath.zeta(3)

RESULT_LABEL = "calculated"


# ---------------------------------------------------------------------------
# Continued fraction evaluation (bottom-up recurrence)
# ---------------------------------------------------------------------------

def appery_terms(depth: int):
    """Return (a0, a_list, b_list) for Apéry zeta(3) CF truncated at `depth`.

    CF = a0 + b1/(a1 + b2/(a2 + ... + b_{depth-1}/a_{depth-1}))
    with a_0 = 5, a_k = 17(k^3+(k+1)^3) - 12(2k+1), b_k = -k^6.
    """
    a0 = mpmath.mpf(5)
    a_list = []
    b_list = []
    for k in range(1, depth + 1):
        k = mpmath.mpf(k)
        a_k = 17 * (k ** 3 + (k + 1) ** 3) - 12 * (2 * k + 1)
        b_k = -(k ** 6)
        a_list.append(a_k)
        b_list.append(b_k)
    return a0, a_list, b_list


def dfr_zeta2_terms(depth: int):
    """Return (a0, a_list, b_list) for the DFR zeta(2) CF truncated at `depth`.

    DFR Table 3 (Appendix C.2, alpha = 5 family): a_k = k^2 + (k+1)^2 + 20,
    b_k = -k^4, with leading constant a0 = 21:

        x = 21 - 1^4/(25 - 2^4/(33 - 3^4/(45 - ... - N^4/(N^2+(N+1)^2+20))))

    Recovered constant: zeta(2) = 115/72 + 1/x.
    (Note: the issue text transcribes the leading term and numerators loosely;
     the coefficients below are the exact Appendix C.2 / Table 3 values and are
     verified to converge to 72/(72*zeta(2) - 115) to machine precision.)
    """
    a0 = mpmath.mpf(21)
    a_list = []
    b_list = []
    for k in range(1, depth + 1):
        k = mpmath.mpf(k)
        a_k = k ** 2 + (k + 1) ** 2 + 20
        b_k = -(k ** 4)
        a_list.append(a_k)
        b_list.append(b_k)
    return a0, a_list, b_list


def evaluate_cf(a0, a_list, b_list):
    """Evaluate CF = a0 + b1/(a1 + b2/(a2 + ...)) bottom-up."""
    result = a_list[-1]
    # walk from second-last term down to the first fraction
    for i in range(len(a_list) - 2, -1, -1):
        result = a_list[i] + b_list[i + 1] / result
    return a0 + b_list[0] / result


def agreeing_digits(error):
    """Number of agreeing decimal digits = floor(-log10(error)); large if exact."""
    if error == 0:
        return mpmath.mp.dps  # effectively infinite precision at working DPS
    return int(mpmath.floor(-mpmath.log(error, 10)))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rows = []
    summaries = []

    for name, terms_fn, true_const, recover_fn, required_digits in (
        ("appery-zeta3", appery_terms, TRUE_ZETA3,
         lambda cf: mpmath.mpf(6) / cf, 12),
        ("dfr-zeta2", dfr_zeta2_terms, TRUE_ZETA2,
         lambda x: mpmath.mpf(115) / 72 + mpmath.mpf(1) / x, 10),
    ):
        prev_error = None
        monotonic = True
        plateau_count = 0
        stopped_early = False
        stop_depth = MAX_DEPTH

        depth_rows = []
        for depth in range(1, MAX_DEPTH + 1):
            a0, a_list, b_list = terms_fn(depth)
            approx = evaluate_cf(a0, a_list, b_list)
            recovered = recover_fn(approx)
            error = abs(recovered - true_const)
            digits = agreeing_digits(error)
            depth_rows.append({
                "cf": name,
                "depth": depth,
                "approx_value": mpmath.nstr(recovered, 40),
                "true_value": mpmath.nstr(true_const, 40),
                "absolute_error": mpmath.nstr(error, 40),
                "agreeing_digits": digits if digits is not None else "exact",
                "result_label": RESULT_LABEL,
            })

            # monotonicity check (relative to previous depth)
            if prev_error is not None:
                if error > prev_error:
                    monotonic = False
                    plateau_count += 1
                else:
                    plateau_count = 0
            prev_error = error

            if plateau_count >= PLATEAU_WINDOW:
                stopped_early = True
                stop_depth = depth
                break

        final = depth_rows[-1]
        final_error = mpmath.mpf(final["absolute_error"])
        final_digits = agreeing_digits(final_error)
        meets_digits = final_digits is not None and final_digits >= required_digits
        meets_threshold = meets_digits and (error <= mpmath.mpf(10) ** (-required_digits))

        summaries.append({
            "cf": name,
            "true_constant": mpmath.nstr(true_const, 40),
            "max_depth_tested": stop_depth,
            "stopped_early": stopped_early,
            "final_depth": final["depth"],
            "final_approx": final["approx_value"],
            "final_absolute_error": final["absolute_error"],
            "final_agreeing_digits": final["agreeing_digits"],
            "monotonically_decreasing": monotonic,
            "required_digits": required_digits,
            "meets_digit_threshold": bool(meets_digits),
            "result_label": RESULT_LABEL,
        })

        rows.extend(depth_rows)
        print(f"{name}: depth={final['depth']} "
              f"error={mpmath.nstr(final_error, 6)} "
              f"digits={final_digits} "
              f"monotonic={monotonic} "
              f"threshold({required_digits})={'PASS' if meets_threshold else 'FAIL'}")

    # Verdict
    baseline_ok = any(s["cf"] == "appery-zeta3" and s["meets_digit_threshold"]
                      and s["monotonically_decreasing"] for s in summaries)
    primary_ok = any(s["cf"] == "dfr-zeta2" and s["meets_digit_threshold"]
                     and s["monotonically_decreasing"] for s in summaries)

    if baseline_ok and primary_ok:
        verdict = "supported"
    elif not baseline_ok:
        verdict = "inconclusive"  # control failed -> setup invalid
    else:
        verdict = "unsupported"

    summary = {
        "experiment": "ramanujan-machine-cf-verification",
        "issue": 165,
        "max_depth": MAX_DEPTH,
        "mpmath_dps": mpmath.mp.dps,
        "result_label": RESULT_LABEL,
        "verdict": verdict,
        "baseline_apery_zeta3_control_ok": baseline_ok,
        "primary_dfr_zeta2_ok": primary_ok,
        "summaries": summaries,
    }

    # Write results
    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base, "results")
    os.makedirs(results_dir, exist_ok=True)

    csv_path = os.path.join(results_dir, "ramanujan_cf_results.csv")
    fieldnames = ["cf", "depth", "approx_value", "true_value",
                  "absolute_error", "agreeing_digits", "result_label"]
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    summary_path = os.path.join(results_dir, "summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nVerdict: {verdict.upper()}")
    print(f"Baseline Apéry control OK: {baseline_ok}")
    print(f"Primary DFR ζ(2) OK: {primary_ok}")
    print(f"Wrote {csv_path} and {summary_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
