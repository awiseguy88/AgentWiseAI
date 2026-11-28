# Report — Counterexample to Kamenetsky's Conjecture on OEIS A173419

**Experiment:** kamenetsky-conjecture-a173419-counterexample
**Issue:** #167
**Source:** R. Patanè, "Counterexamples to a conjecture of Kamenetsky on OEIS A173419",
arXiv:2609.28512 [math.GM], DOI 10.48550/arXiv.2609.28512 (2026); OEIS A173419.
**Reproduction:** `python3 simulate.py` (Python 3, standard library only, ~4 s on a single core)

## The claim

Kamenetsky's conjecture (OEIS A173419 comment, December 2019):
`a(p) >= a(p-1)` for every prime `p`, noted to hold for all primes `p < 1800`.
Here `a(n)` is the length of the shortest computation yielding `n` from `x_0 = 1`
using addition, subtraction, and multiplication (`x_k = x_i + x_j`, `x_i * x_j`,
or `x_i - x_j`, `0 <= i, j < k`; chains may reuse earlier entries).

Patanè (2026) disproves the conjecture at `p = 3359`: the explicit chain
`1, 2, 4, 16, 15, 225, 3375, 3359` gives `a(3359) <= 7`, while `a(3358) >= 8`,
so `a(3359) < a(3358)`.

## Hypothesis (signed, frozen before running)

`a(3359) = 7 AND a(3358) = 8`, hence `a(3359) < a(3358)`, so Kamenetsky's
conjecture is false at `p = 3359` (the smallest counterexample below 5000).

## Method

- **Explicit chains (calculated):** each candidate chain is validated step by
  step with exact integer arithmetic — every entry must be `x_i + x_j`,
  `x_i * x_j`, or `x_i - x_j` of two earlier entries. Exact, no simulation.
- **Exhaustive enumeration (simulated):** all chains up to a fixed depth are
  enumerated as value sets `{x_0, ..., x_d}`; every set extension adds one new
  entry derived from two entries already present. No value cap is applied, so
  the enumeration is exact and finite. It records the minimum depth at which
  each value is reachable (`simulate.py`, `enumerate_to_depth`).
- **Baseline control (calculated check):** `a(1)..a(108)` is recomputed by the
  same exhaustive enumeration and compared entry-by-entry with the published
  OEIS A173419 b-file values embedded in `simulate.py`.

All arithmetic is on Python integers (exact). The upper bounds come from
explicit chains (calculated); the lower bounds come from exhaustive enumeration
(simulated).

## Results

| # | Result | Value | Label | Evidence |
|---|--------|-------|-------|----------|
| 1 | Explicit chain for 3359 `1,2,4,16,15,225,3375,3359` validated | 7 operations; every step `+`, `-`, or `*` of earlier entries | **calculated** | `simulate.py` `chain_is_valid`; `results/bounds_summary.json` chain validation |
| 2 | Explicit chain for 3358 `1,2,4,16,15,17,225,3375,3358` validated | 8 operations; every step `+`, `-`, or `*` of earlier entries | **calculated** | `simulate.py` `chain_is_valid`; `results/bounds_summary.json` chain validation |
| 3 | `a(3359)` not reachable at depth <= 6 (exhaustive search to depth 8) | min depth = 7 | **simulated** | `results/reachable_per_depth.txt` (depth 6: 3359 absent; depth 7: first reached), `results/bounds_summary.json` |
| 4 | `a(3358)` not reachable at depth <= 7 (exhaustive search to depth 8) | min depth = 8 | **simulated** | `results/reachable_per_depth.txt` (depth 7: 3358 absent; depth 8: first reached), `results/bounds_summary.json` |
| 5 | `a(3359)` | 7 | mixed (upper bound **calculated**, lower bound **simulated**) | rows 1 + 3 |
| 6 | `a(3358)` | 8 | mixed (upper bound **calculated**, lower bound **simulated**) | rows 2 + 4 |
| 7 | Baseline control `a(1)..a(108)` vs OEIS A173419 b-file | 108/108 exact match (e.g. a(1)=0, a(2)=1, a(3)=2, ..., a(108)=5) | **calculated** (exact integer enumeration compared to the published reference) | `results/a1_108.csv`, `results/bounds_summary.json` oeis_control |

Per-depth enumeration summary (raw output, `results/reachable_per_depth.txt`):

| Depth | Chain value-sets | New values first reached | 3358 reached? | 3359 reached? |
|-------|------------------|--------------------------|---------------|---------------|
| 1 | 1 | 1 | no | no |
| 2 | 2 | 2 | no | no |
| 3 | 8 | 5 | no | no |
| 4 | 59 | 17 | no | no |
| 5 | 663 | 76 | no | no |
| 6 | 10,609 | 460 | no | no |
| 7 | 225,219 | 3,801 | no | **yes** |
| 8 | — | 41,791 | **yes** | — |

Enumeration set counts `|F_d| = 1, 2, 8, 59, 663, 10609, 225219` reproduce the
independent reference implementation (patan3saro/A173419-counterexample,
verify.py) exactly.

## Threshold evaluation (from experiment.yaml)

- PASS condition 1 — `a(3359) = 7`: no chain <= 6 yields 3359 (simulated, confirmed) AND explicit length-7 chain valid (calculated, confirmed) → `a(3359) <= 7` → PASS
- PASS condition 2 — `a(3358) = 8`: no chain <= 7 yields 3358 (simulated, confirmed) AND explicit length-8 chain valid (calculated, confirmed) → `a(3358) <= 8` → PASS
- PASS condition 3 — `a(3359) < a(3358)`: `7 < 8` → PASS

Baseline control `a(1)..a(108)` vs OEIS: exact match → experiment trusted.

## Verdict

**supported** — the simulation confirms `a(3359) = 7 < 8 = a(3358)`.
Kamenetsky's conjecture `a(p) >= a(p-1)` for every prime `p` is **false**,
with `p = 3359` the first failure point (also reported by Patanè 2026;
three further counterexamples below 5000: 3623, 4909, 4943, out of scope here).

## Reproduction

```
python3 simulate.py
```

Standard library only; no network or external dependencies. Expected runtime
under 2 minutes (measured ~4 s). Raw output is written to `results/`.

## Limitations

- The enumeration is exhaustive to depth 8 only; values requiring more
  operations are reported as unreachable within the searched depth, not as
  proven larger.
- The lower bounds rest on exhaustive enumeration (simulated); an
  implementation bug that misses reachable chains would underestimate `a(n)`.
  Mitigations: explicit chains are validated step by step, and the `a(1)..a(108)`
  recomputation matches the OEIS b-file exactly before the 3359/3358 results
  are trusted.
- No physical measurement or hardware is involved; all values are dimensionless
  integer operation counts.
