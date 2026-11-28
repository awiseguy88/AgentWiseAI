# Symmetric-Maximizer Conjecture Counterexample for Lyapunov Operators — Order 7 Report

**Experiment ID:** lyapunov-symmetric-maximizer-order7  
**GitHub Issue:** #171  
**Date:** 2026-11-23  
**Status:** COMPLETED — Supported  
**Result label:** calculated (exact integer/rational arithmetic; no physical measurement, no stochastic simulation)

---

## Summary

This experiment tests the symmetric-maximizer conjecture for Lyapunov operators: for every matrix A, the Frobenius-induced operator norm of L_A(X) = A X + X A^T is attained at a symmetric matrix (‖L_A|_K_n‖ ≤ ‖L_A|_S_n‖). The conjecture is known to hold for n ≤ 5 (Chen–Tian 2015).

Using the explicit integer matrix A of order 7 from Kressner & Vandereycken (2026, arXiv:2608.20875, Theorem 2, Eq. 4) and the skew-symmetric witness K from the proof:

- ‖K‖_F^2 = **53836** (exact integer)
- ‖L_A(K)‖_F^2 = **64387950** (exact integer)
- ratio ‖L_A(K)‖_F^2 / ‖K‖_F^2 = 64387950/53836 ≈ **1196.0017 > 1196**
- symmetric max eigenvalue (float64 control) = **1195.593985 < 1196**
- skew max eigenvalue (float64 control) = **1196.025224 > 1196**
- exact certificate M_S = 1196 D_S − B_Sᵀ D_S B_S ≻ 0; all **28** LDLᵀ pivots d_i ≥ **82**, min pivot **82.231**

Combining: ‖L_A|_S7‖² < 1196 < ‖L_A|_K7‖², so the operator-norm maximum is attained on a skew-symmetric matrix, not at any symmetric matrix. **The symmetric-maximizer conjecture is false at n = 7.**

**Verdict: SUPPORTED** (the counterexample claim is supported).

---

## Method

### Model

L_A(X) = A X + X A^T on R^{7×7}, equipped with the Frobenius inner product. The symmetric subspace S_7 (dim 28) and skew-symmetric subspace K_7 (dim 21) are invariant under L_A. Relative to this decomposition,

‖L_A|_U_7‖² = max_{x≠0} xᵀ B_Uᵀ D_U B_U x / xᵀ D_U x,

a generalized eigenvalue problem, where B_U is the coordinate matrix of L_A in the basis of U and D_U is its Gram matrix:
- D_S = diag(I_7, 2·I_21)
- D_K = 2·I_21

### Exact certificate (calculated)

For the symmetric restriction, set M_S := 1196·D_S − B_Sᵀ D_S B_S. Exact rational arithmetic yields M_S = L diag(d_1, …, d_28) Lᵀ (unit lower triangular L) with all d_i ≥ 82, hence M_S ≻ 0, giving ‖L_A|_S7‖² < 1196. All arithmetic (A, K, ‖K‖_F², ‖L_A(K)‖_F², B_S, M_S, LDLᵀ pivots) uses exact integer / rational arithmetic (Python `fractions`), so no floating-point rounding affects the sign of M_S or d_i ≥ 82.

### Float64 controls (simulated / numeric)

Generalized eigensolver (SciPy) gives ‖L_A|_S7‖² ≈ 1195.593985 and ‖L_A|_K7‖² ≈ 1196.025224, matching the paper's motivating values (Remark 3). These numerics motivate but are not used in the proof.

### n ≤ 5 controls

The same restricted-norm pipeline on random integer matrices of order n ∈ {2, 3, 4, 5} confirms ‖L_A|_K‖ ≤ ‖L_A|_S‖, validating the construction before trusting the n = 7 counterexample (conjecture holds there, as expected).

---

## Results

| Invariant | Value | Expected | Status | Label |
|---|---|---|---|---|
| ‖K‖_F^2 | 53836 | 53836 | PASS | calculated |
| ‖L_A(K)‖_F^2 | 64387950 | 64387950 | PASS | calculated |
| ratio ‖L_A(K)‖_F^2 / ‖K‖_F^2 | 1196.0017 | > 1196 | PASS | calculated |
| K skew-symmetric | yes | yes | PASS | calculated |
| symmetric max eigenvalue (float64) | 1195.593985 | < 1196 | PASS | simulated (numeric control) |
| skew max eigenvalue (float64) | 1196.025224 | > 1196 | PASS | simulated (numeric control) |
| M_S ≻ 0 (exact certificate) | yes | yes | PASS | calculated |
| LDLᵀ pivots d_i ≥ 82 (28 pivots) | min 82.231 | all ≥ 82 | PASS | calculated |
| n ≤ 5 controls (skew ≤ sym) | yes | yes | PASS | simulated (numeric control) |

Raw output: `results/output.json` and `results/invariants.txt`.

---

## Acceptance Checks (from experiment.yaml)

| Criterion | Threshold | Result |
|---|---|---|
| Reproduction command regenerates results | `python3 simulate.py` prints PASS verdict | PASS |
| ‖K‖_F^2 == 53836 | exact | PASS (53836) |
| ‖L_A(K)‖_F^2 == 64387950 | exact | PASS (64387950) |
| skew ratio > 1196 | 64387950/53836 ≈ 1196.0017 | PASS |
| symmetric max eigenvalue < 1196 | numeric | PASS (1195.593985) |
| M_S ≻ 0, all pivots ≥ 82 | exact certificate | PASS (min 82.231) |
| n ≤ 5 controls hold | ‖L_A|_K‖ ≤ ‖L_A|_S‖ | PASS |
| results/ contains required output | output.json, invariants.txt | PASS |
| report labels calculated vs simulated | each result labeled | PASS |
| Smoke test passes | `python test_smoke.py` | PASS |
| Verdict supported / unsupported / inconclusive | Report states verdict | SUPPORTED |

Verdict details: all pass conditions met → **supported**.

---

## Reproduction

```bash
cd <repo root>
python3 experiments/lyapunov-symmetric-maximizer-order7/simulate.py
```

Prints a PASS/FAIL verdict and writes `results/output.json` and `results/invariants.txt`. Expected runtime: seconds, single-core.

### Smoke test

```bash
python3 experiments/lyapunov-symmetric-maximizer-order7/test_smoke.py
```

### CI

Added as a CI job under `.github/workflows/ci.yml` ("Lyapunov Symmetric-Maximizer Counterexample"), installing `numpy` and `scipy`, running `python test_smoke.py` on every push/PR.

---

## Files Produced

| File | Description |
|---|---|
| `sources.md` | Source reference (Kressner & Vandereycken 2026, arXiv:2608.20875, DOI 10.48550/arXiv.2608.20875) with value-to-location mapping |
| `experiment.yaml` | Signed hypothesis, baseline (holds for n ≤ 5), metric, units, threshold, stop condition |
| `simulate.py` | Exact-integer / rational computation of A, K, norms, LDLᵀ certificate, float64 controls |
| `test_smoke.py` | Automated smoke test |
| `results/output.json` | Raw machine-readable output for every invariant |
| `results/invariants.txt` | Human-readable raw invariants |
| `report.md` | This report |

Result label: **calculated** (exact arithmetic derivation from the published integer matrices).

---

## Sensitivity Analysis

- **Transcription robustness:** A and K transcribed directly from arXiv:2608.20875 (Eq. 4 and proof). All integer identities reproduce exactly, confirming correct transcription (a wrong entry/sign would break skewness or the integer identities).
- **Certificate robustness:** min pivot 82.231 is comfortably above the 82 threshold, with margin ~0.3. The exact certificate does not depend on floating point.
- **Float64 cross-check:** symmetric max eigenvalue 1195.593985 and skew 1196.025224 match the paper's motivating values exactly, corroborating ‖L_A|_S7‖² < 1196 < ‖L_A|_K7‖².
- **n ≤ 5 controls:** confirm the construction is well-behaved where the conjecture is known to hold.

---

## Discussion

The exact certificate M_S ≻ 0 (all pivots ≥ 82) proves ‖L_A|_S7‖² < 1196 without relying on floating-point computations. The integer identities ‖K‖_F^2 = 53836 and ‖L_A(K)‖_F^2 = 64387950 give ‖L_A|_K7‖² ≥ 64387950/53836 ≈ 1196.0017 > 1196. Hence ‖L_A|_S7‖² < 1196 < ‖L_A|_K7‖² and the operator-norm maximum is attained on a skew-symmetric matrix, disproving the symmetric-maximizer conjecture at n = 7.

Per the paper, n = 6 remains the only unresolved dimension; counterexamples extend to every n ≥ 7 by direct sum. This experiment does not claim seven is the smallest counterexample order.

**Conclusion:** The symmetric-maximizer conjecture for Lyapunov operators is **false at order seven**; the claim in the experiment is **supported**.
