# Stable Schur Positivity Counterexample — Report

**Experiment ID:** stable-schur-positivity-counterexample  
**GitHub Issue:** #175  
**Date:** 2026-11-23  
**Status:** COMPLETED — Supported  
**Result label:** calculated (exact integer/rational arithmetic; matrices and minors transcribed from the source; no physical measurement)

---

## Summary

This experiment tests Borcea–Brändén Problem 36: whether every symmetric, real stable,
homogeneous polynomial of degree d ≤ n with non-negative monomial coefficients is
Schur-positive. Sra (2026, arXiv:2608.29595, Section 3.2 / Theorem 3.7) answers **no**
already at d = n = 5, with an explicit determinantal pencil J1..J5.

**Verdict: SUPPORTED (the conjecture is refuted).** Exact arithmetic confirms:

- All five matrices J1..J5 are symmetric positive definite (leading principal minors
  Δ1..Δ5 > 0, matching the source), hence real stable.
- The monomial expansion of q = (1/648) det(Σ xi Ji) matches the listed coefficients.
- Inverting the Kostka matrix over ℤ yields the Schur expansion, whose coefficient
  [s_(1^5)]q = −2972 < 0.
- The closed-form identity 1728 − 2(19440) − 2(66555) + 3(140910) + 3(250440)
  − 4(547405) + 1182860 = −2972 holds independently.

Therefore q is symmetric, real stable, homogeneous of degree 5, has all 126 monomial
coefficients strictly positive, yet is not Schur-positive: Problem 36 is refuted.

---

## Method

### Matrices (source: arXiv:2608.29595 Section 3.2)

J1..J5 are the explicit symmetric integer 5×5 matrices from Section 3.2 (Theorem 3.7).
The construction is not a numerical accident: V = ker B ≅ S_(3,2), P_i the rank-three
projection attached to the point stabilizer of i, G the Gram matrix of a basis of V, and
J_i = 2G(I + 5P_i) (Appendix C); t = 5 clears denominators.

### Positive definiteness

For each J_i the leading principal minors Δ1..Δ5 were computed exactly and checked > 0
(Sylvester's criterion), matching the values in Section 3.2. Hence J_i ≻ 0 and q is real
stable; homogeneity of degree 5 is immediate.

### Monomial expansion

det(Σ xi Ji) was expanded exactly into all 126 monomials (Python fractions, no floating
point), divided by 648, and reduced to monomial-symmetric coefficients m_λ for
λ ⊢ 5. Result matches Section 3.2 exactly.

### Schur expansion (Kostka inversion)

The Kostka matrix K in partition order (5),(4,1),(3,2),(3,1,1),(2,2,1),(2,1,1,1),(1^5)
was taken from Section 3.2 and independently re-derived by enumerating semistandard
Young tableaux (both matrices agree). Solving c = a K over ℤ (a = c K^{-1}) gives the
Schur coefficients below.

### Baseline control

The same Kostka-inversion pipeline was applied to h_5 = Σ_{λ⊢5} m_λ = s_(5) (equivalently
the mixed determinant η(x1 A, ..., xn A) with a single PSD matrix A), a known
Schur-positive stable polynomial. It yields Schur coefficients [1, 0, 0, 0, 0, 0, 0],
all ≥ 0, validating the inversion before trusting the negative coefficient.

---

## Results

### Leading principal minors (Δ1..Δ5)

| matrix | Δ1 | Δ2 | Δ3 | Δ4 | Δ5 | all > 0 |
|---|---|---|---|---|---|---|
| J1 | 38 | 1083 | 28728 | 202176 | 1119744 | yes |
| J2 | 38 | 1083 | 28728 | 202176 | 1119744 | yes |
| J3 | 38 | 288 | 8208 | 202176 | 1119744 | yes |
| J4 | 38 | 288 | 8208 | 46656 | 1119744 | yes |
| J5 | 8 | 288 | 1728 | 46656 | 1119744 | yes |

Label: **calculated** (exact integer arithmetic; transcribed from source Section 3.2).

### Monomial coefficients of q

| partition λ | m_λ coefficient | matches source |
|---|---|---|
| (5) | 1728 | yes |
| (4,1) | 19440 | yes |
| (3,2) | 66555 | yes |
| (3,1,1) | 140910 | yes |
| (2,2,1) | 250440 | yes |
| (2,1,1,1) | 547405 | yes |
| (1^5) | 1182860 | yes |

Label: **calculated** (exact determinant expansion; matches source Section 3.2).

### Schur coefficients of q

| partition λ | s_λ coefficient | matches source |
|---|---|---|
| (5) | 1728 | yes |
| (4,1) | 17712 | yes |
| (3,2) | 47115 | yes |
| (3,1,1) | 56643 | yes |
| (2,2,1) | 62415 | yes |
| (2,1,1,1) | 56437 | yes |
| (1^5) | −2972 | yes |

Label: **calculated** (exact Kostka inversion over ℤ; independently re-derived K via SSYT enumeration).

### Single-coefficient identity

[s_(1^5)]q = 1728 − 2(19440) − 2(66555) + 3(140910) + 3(250440) − 4(547405) + 1182860 = **−2972 < 0**. Label: **calculated**.

### Baseline control

h_5 Schur coefficients: [1, 0, 0, 0, 0, 0, 0] (all ≥ 0). Label: **calculated**.

---

## Acceptance Checks (from experiment.yaml)

| Criterion | Threshold | Result |
|---|---|---|
| Reproduction command | `python3 simulate.py` regenerates results/ | PASS |
| Ji all PSD | Δ1..Δ5 > 0 for each Ji | PASS |
| Monomial expansion matches | coefficients equal listed values | PASS |
| Kostka inversion | [s_(1^5)]q == −2972 | PASS |
| Closed-form identity | equals −2972 | PASS |
| Baseline control | h_5 all Schur coeffs ≥ 0 | PASS |
| Independent Kostka (SSYT) | matches quoted K | PASS |
| Raw output | results/results.json, results/coefficients.txt | PASS |
| Result label | calculated | PASS |
| Smoke test | `python3 test_smoke.py` | PASS |
| Verdict | supported / unsupported / inconclusive | SUPPORTED |

Verdict details: all pass conditions met → **supported** (conjecture refuted).

### Reproduction

```bash
cd <repo root>
python3 experiments/stable-schur-positivity-counterexample/simulate.py
```

Regenerates `results/results.json` and `results/coefficients.txt` (runs in seconds,
single-core).

### Smoke test

```bash
python3 experiments/stable-schur-positivity-counterexample/test_smoke.py
```

### CI

Added as a CI job under `.github/workflows/ci.yml` ("Stable Schur Positivity
Counterexample"), running `python3 test_smoke.py` on every push/PR.

---

## Files Produced

| File | Description |
|---|---|
| sources.md | Source references (Sra 2026 arXiv:2608.29595 DOI 10.48550/arXiv.2608.29595; Borcea–Brändén 2009 AIM Problem 36) |
| experiment.yaml | Signed hypothesis, baseline, metric [s_(1^5)]q, units, thresholds, stop condition |
| simulate.py | Reproducible exact-arithmetic verification (PSD minors, determinant expansion, Kostka inversion, baseline) |
| test_smoke.py | Automated smoke test |
| results/results.json | Raw output: matrices, minors, monomial coefficients, Schur coefficients, verdict |
| results/coefficients.txt | Human-readable coefficients output |
| report.md | This report |

Result label: **calculated** (exact arithmetic; no physical measurement).

---

## Sensitivity Analysis

- **Sign robustness:** [s_(1^5)]q = −2972 follows from exact integer arithmetic (the closed-form identity), so there is no float-rounding risk to the sign.
- **Kostka independence:** the Schur coefficients were recomputed with an independently derived Kostka matrix (SSYT enumeration), which matches the quoted matrix exactly.
- **Baseline:** the inversion pipeline correctly recovers a Schur-positive control (h_5), so the negative coefficient is not an artifact of the inversion.
- **Scope:** only d = n = 5 is claimed; no assertion about other (d,n).

---

## Discussion

The experiment refutes Borcea–Brändén Problem 36: stability does not force Schur-positivity,
already at d = n = 5. q is symmetric, real stable (all J_i ≻ 0 by Sylvester), homogeneous of
degree 5, and every one of its 126 monomial coefficients is strictly positive, yet
[s_(1^5)]q = −2972 < 0, so q is not Schur-positive. The result is fully reproducible in
software with exact arithmetic — no physical measurement is involved.

**Conclusion:** the claim that every symmetric real stable homogeneous polynomial with non-negative
monomial coefficients is Schur-positive is **refuted** (Problem 36 answered negatively).
