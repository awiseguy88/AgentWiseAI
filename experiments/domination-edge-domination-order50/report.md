# Domination-versus-Edge-Domination Counterexample Report (50-Vertex Cubic Graph)

**Experiment ID:** domination-edge-domination-order50  
**GitHub Issue:** #173  
**Date:** 2026-11-23  
**Status:** COMPLETED — Supported  
**Result label:** calculated (exact deterministic finite computation; no randomness, no measurement)

## Summary

This experiment tests the hypothesis that, for the explicit 50-vertex cubic graph G of Afrasyab (arXiv:2609.10783),
γ_e(G) == 15 AND γ(G) == 16, i.e. the domination number strictly exceeds the edge domination number,
so the Domination-versus-Edge-Domination Conjecture (Baste, Fürst, Henning, Mohr, Rautenbach 2019/2020)
is false already for cubic graphs (Δ = 3).

**Verdict: SUPPORTED.** The exact computation reproduces γ_e(G) = 15 and γ(G) = 16, so γ(G) > γ_e(G).
The conjecture is falsified for Δ = 3. The graph is order-minimal among cubic counterexamples
(Gupta 2026 proves the conjecture for every cubic graph on at most 48 vertices).

## Method

### Graph construction

G is the public 50-vertex formula-incidence graph from Section 2 of Afrasyab (arXiv:2609.10783):

- 20 clause vertices c₁..c₂₀ (labeled c_a = 29+a, a = 1..20).
- 30 literal vertices v₁⁻,v₁⁺..v₁₅⁻,v₁₅⁺ (labeled v_j⁻ = 2(j−1), v_j⁺ = 2(j−1)+1).
- 75 edges: 15 pair edges v_j⁻v_j⁺ plus 3 literal edges per clause from `counterexample.edgelist`.
- Cubic (degree 3), connected; |V| = 50, |E| = 75.

All computations are exact integer arithmetic in the Python 3 standard library only. No randomness,
no measurement, no physical hardware.

### gamma_e(G) = 15 (calculated)

Section 3 of the paper:

- M = {v_j⁻v_j⁺ : 1 ≤ j ≤ 15} is a matching of size 15 (the pair edges). It is maximal because
  the 20 unmatched vertices are precisely the clause vertices, and no two clause vertices are adjacent.
  Hence γ_e(G) ≤ 15.
- In a cubic graph an edge is adjacent to at most 4 other edges (2 at each endpoint), so a single edge
  dominates at most 5 edges including itself. With 75 edges, every edge-dominating set has size at
  least ceil(75/5) = 15. Hence γ_e(G) ≥ 15.
- Therefore γ_e(G) = 15.

### gamma(G) <= 16 (calculated)

Section 4 of the paper:

- D₀ = {0,2,5,7,8,13,15,30,31,32,33,35,37,42,46,48} is an explicit dominating set of order 16,
  verified directly from the raw edge list: every vertex belongs to D₀ or has a neighbor in D₀.
  Hence γ(G) ≤ 16.

### gamma(G) >= 16 (calculated)

Sections 5–6 of the paper:

- For fixed T ⊆ C (the clause vertices in a putative dominating set), the remaining literal choices
  form a finite set-cover problem. Two exact lower bounds give
  L(T) = |T| + max{|U| − ν(H[U]), q(T)}, where U = C \ T, H is the cubic clause graph,
  ν(H[U]) is its maximum matching size, and q(T) is the number of "unsafe" variables.
- All 2²⁰ = 1,048,576 clause subsets T are enumerated. Only 5,931 residual cases have L(T) ≤ 15;
  each is solved exactly by the set-cover recurrence
  F_T(R) = 1 + min_ℓ F_T(R \ A_T(ℓ)), and every residual case has total at least 16.
- Hence no dominating set of size at most 15 exists, so γ(G) ≥ 16.

Combined with D₀ (|D₀| = 16 dominating), γ(G) = 16.

### Independent checks

- Direct branch-and-bound domination search: k=15 exists=False, k=16 exists=True → confirms γ(G) = 16.
- Cross-check γ_e(G) = 15 via the matching maximality argument and counting lower bound.
- Small-graph controls (calculated): K4, K_{3,3}, Q3 (cube), Petersen all satisfy γ ≤ γ_e,
  validating the pipeline.

## Results

| Invariant | Value | Label | Source |
|---|---|---|---|
| |V| | 50 | calculated | Section 2 / counterexample.edgelist |
| |E| | 75 | calculated | Section 2 / counterexample.edgelist |
| cubic, connected | yes | calculated | Section 2 |
| γ_e(G) | 15 | calculated | Section 3 (Proposition 2) |
| maximal matching M size | 15 | calculated | Section 3 |
| edge-domination lower bound ceil(75/5) | 15 | calculated | Section 3 |
| D₀ (dominating witness) size | 16 | calculated | Section 4 |
| D₀ dominates all 50 vertices | True | calculated | Section 4 |
| clause subsets enumerated | 1,048,576 | calculated | Sections 5–6 |
| residual exact set-cover cases | 5,931 | calculated | Section 6 |
| minimum exact total over residual cases | 16 | calculated | Section 6 |
| γ(G) | 16 | calculated | Sections 4–6 |
| direct search k=15 | exists=False | calculated | Section 7 |
| direct search k=16 | exists=True | calculated | Section 7 |
| γ(G) > γ_e(G) → conjecture falsified | True | calculated | Theorem 1 |

All results in this experiment are labeled **calculated**: they come from an exact deterministic
finite integer computation reproducing the paper's arithmetic, not from stochastic simulation or
physical measurement. No results are labeled simulated.

## Acceptance Checks (from experiment.yaml)

| Criterion | Threshold | Result |
|---|---|---|
| Reproduction command runs | `python3 simulate.py` prints PASS | PASS |
| sources.md cites arXiv:2609.10783 DOI 10.48550/arXiv:2609.10783 | yes | PASS |
| experiment.yaml signed (hypothesis, baseline, metric, units, threshold, stop condition) | yes | PASS |
| test_smoke.py passes | 9/9 checks | PASS |
| results/ contains raw output for every invariant | results/verification.txt | PASS |
| report.md labels each result calculated/simulated | all calculated | PASS |
| Verdict stated | supported / unsupported / inconclusive | SUPPORTED |

## Verdict

**SUPPORTED.** γ_e(G) = 15 and γ(G) = 16 are both reproduced exactly, so the domination number
strictly exceeds the edge domination number on this cubic graph of order 50. The
Domination-versus-Edge-Domination Conjecture is false already for Δ = 3, and this is the
order-minimal cubic counterexample.

## Reproduction

```bash
cd <repo root>
python3 experiments/domination-edge-domination-order50/simulate.py
```

Runs from a clean checkout in about 10 seconds on a single core, Python 3 standard library only,
and prints `PASS` with full results.

### Smoke test

```bash
cd <repo root>
python3 experiments/domination-edge-domination-order50/test_smoke.py
```

### CI

Added as a CI job under `.github/workflows/ci.yml` ("Domination-versus-Edge-Domination"),
running `python test_smoke.py` on every push/PR.

## Files Produced

| File | Description |
|---|---|
| `sources.md` | Source references (Afrasyab arXiv:2609.10783 DOI 10.48550/arXiv:2609.10783 plus Theorem 1 and Sections 2–7, Appendix A) |
| `experiment.yaml` | Signed hypothesis, baseline, metric, units, threshold, stop condition |
| `verify_domination.py` | Exact verification (Python stdlib only) |
| `simulate.py` | Reproduction entry point (`python3 simulate.py`) |
| `test_smoke.py` | Automated smoke test |
| `counterexample.edgelist` | Raw 75-edge graph input |
| `counterexample.json` | Canonical construction, clauses, matching, witness |
| `results/verification.txt` | Raw output for every invariant |
| `report.md` | This report |

Result label: **calculated** (exact deterministic finite computation; no physical measurement).