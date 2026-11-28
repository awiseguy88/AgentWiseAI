# Ramanujan Machine Continued-Fraction Conjecture Verification — Report

**Experiment ID:** ramanujan-machine-cf-verification
**GitHub Issue:** #165
**Date:** 2026-11-22
**Status:** COMPLETED — Supported
**Result label:** calculated (all results computed numerically; no physical measurement)

---

## Summary

This experiment independently verifies (at high depth, with arbitrary-precision arithmetic) two
continued fractions from Elimelech et al. 2023 (arXiv:2308.11829 / PNAS DOI 10.1073/pnas.2321440121):

1. **Baseline control (proven):** Apéry's continued fraction for ζ(3) (Eq. 1) must reach
   ≥ 12 correct digits at depth N = 200.
2. **Primary claim (conjectured):** A DFR-discovered continued fraction for ζ(2) must reach
   ≥ 10 correct digits at depth N = 200 with monotonically decreasing error.

**Verdict: SUPPORTED.** The Apéry control reaches the full working precision (80 digits) at
depth 200 (far above the 12-digit threshold), confirming the evaluation method. The DFR
ζ(2) CF reaches 22 correct digits at depth 200 with strictly decreasing error at every depth,
confirming the conjectured convergence and ruling out a PSLQ over-fit at the tested depth.

## Method

### Governing formulas

- **Apéry (control):** 6/ζ(3) = a₀ + b₁/(a₁ + b₂/(a₂ + ...)) with
  a₀ = 5, aₖ = 17(k³ + (k+1)³) − 12(2k+1), bₖ = −k⁶.
  ζ(3) = 6 / (convergent).

- **DFR ζ(2) (claim under test):** x = 21 − 1⁴/(25 − 2⁴/(33 − 3⁴/(45 − ...)))
  with aₖ = k² + (k+1)² + 20, bₖ = −k⁴ (Appendix C.2, Table 3, α = 5 family).
  x = 72/(72·ζ(2) − 115), so ζ(2) = 115/72 + 1/x.

### Evaluation

Each CF is truncated at depth N = 1 … 200 and evaluated bottom-up with mpmath at
80 decimal digits. For each depth: truncation depth, approximate value, true constant,
absolute error, agreeing digits. Results are recorded in `results/ramanujan_cf_results.csv`.

## Results

| CF | Depth 200 abs. error | Agreeing digits | Monotonic decrease? | Threshold | Result |
|---|---|---|---|---|---|
| Apéry ζ(3) (control) | 0 (exact to working precision) | 80 | Yes | ≥ 12 digits | PASS |
| DFR ζ(2) (primary) | 2.38e-23 | 22 | Yes | ≥ 10 digits | PASS |

Both CFs satisfy their thresholds; the DFR ζ(2) CF agrees with ζ(2) = π²/6 to 22 digits at
depth 200 and the error decreases at every single depth from 1 to 200, which is inconsistent
with a PSLQ over-fit (which would plateau or diverge).

## Acceptance Checks (from experiment.yaml)

| Criterion | Threshold | Result |
|---|---|---|
| sources.md lists arXiv:2308.11829 + PNAS DOI | — | PASS |
| experiment.yaml records hypothesis, baseline, metric, units, threshold, stop condition | — | PASS |
| Reproduction command runs cleanly from clean checkout | `python .../simulate.py` | PASS |
| Baseline Apéry CF ≥ 12 correct digits at N = 200 | error ≤ 1e-12 | PASS (exact to 80 digits) |
| report.md states supported/unsupported/inconclusive; every result labeled calculated/simulated | — | PASS (supported; calculated) |
| Smoke test passes | `python .../test_smoke.py` | PASS (9/9) |

## Reproduction

```bash
cd <repo root>
python experiments/ramanujan-machine-cf-verification/simulate.py
```

Regenerates `results/ramanujan_cf_results.csv` and `results/summary.json`.

## Smoke test

```bash
python experiments/ramanujan-machine-cf-verification/test_smoke.py
```

## Files Produced

| File | Description |
|---|---|
| `sources.md` | Source references with section/figure locators |
| `experiment.yaml` | Signed hypothesis, baseline, metric, units, threshold, stop condition |
| `simulate.py` | Reproducible CF verification (Python + mpmath) |
| `test_smoke.py` | Automated smoke test (9 checks) |
| `results/ramanujan_cf_results.csv` | Raw per-depth error output (labeled calculated) |
| `results/summary.json` | Machine-readable summary with verdict |
| `report.md` | This report |

Result label: **calculated** (all results computed numerically; no physical measurement).