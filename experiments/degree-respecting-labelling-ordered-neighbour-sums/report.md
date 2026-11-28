# Degree-Respecting Labellings with Ordered Neighbour Sums (calculated)

Independent software reproduction of **Ishikawa & Uda (2026)**, *Degree-respecting
labellings with ordered neighbour sums*, arXiv:2611.34269v1 [math.CO],
DOI [10.48550/arXiv.2611.34269](https://doi.org/10.48550/arXiv.2611.34269) —
**Theorem 1** and **Corollary 2**.

**Verdict: SUPPORTED** (all results **calculated** with exact integer/rational arithmetic;
nothing simulated or measured).

## What the paper claims

For every finite simple graph `G=(V,E)` with `|V|=n`, label set `I_n={0,...,n-1}`, and any
strictly increasing `c:I_n→R`, there is a bijection `f:V→I_n` satisfying:

- **(1.1) degree condition:** `d(v) < d(w) ⟹ f(w) < f(v)` (larger degree ⇒ smaller label);
- **(1.3) equal-degree neighbour-sum condition:** if `d(v)=d(w)` and `f(w)<f(v)` then
  `Σ_{u∈N(v)} c(f(u)) ≤ Σ_{u∈N(w)} c(f(u))`.

The proof (Section 2) picks `f` minimizing the **edge potential**
`Φ(g)=Σ_{{x,y}∈E} c(g(x))·c(g(y))` over the finite nonempty set `A` of degree-respecting
labellings; a single label-exchange argument on any violating equal-degree pair (Eq. 2.2)
shows `Φ` cannot decrease, so no violation exists. **Corollary 2** is the `c(i)=2^i` case;
**Remark 3** notes the `{1,...,n}`/`2^k` convention is just `2×` the `I_n` convention, so
neither rule changes.

## Signed hypothesis (frozen before running)

For every tested `(G,c)` the edge-potential-minimizing degree-respecting labelling `f*`
satisfies both (1.1) and (1.3) **exactly** (0 violations); the valid labelling is generally
non-unique (Example 4 has exactly two). Reproduction is **calculated**.

## Method (all exact)

`run.py` enumerates every degree-respecting labelling by `itertools.permutations`, computes
`Φ` exactly (`int` for `c(i)=2^i` and `c(i)=i`; `fractions.Fraction` for the nonlinear
rational `c(i)=i²+i/2+1/7` and a shifted-linear weight), selects an `f*` attaining the
brute-force minimum of `Φ`, and counts (1.1)/(1.3) violations of `f*` with exact
comparisons. The valid-labelling count per graph is the number of degree-respecting
labellings that also satisfy (1.3).

Tested catalogue: **35 graphs** × **4 weight functions** = **140 cases**:
Example 4 (2-methylbutane), `K_1..K_6`, `P_1..P_7`, stars `K_{1,1..6}`, empty graphs on
1–6 vertices, paw, diamond, `C_4,C_5,C_6`, double-star, `K_{2,3}`, barbell, and a
disconnected `2K_2`. Weights: `2^i`, `i`, nonlinear `i²+i/2+1/7`, shifted-linear `i+1`.

## Results

### Headline metric (primary)

| Metric | Value |
|---|---|
| Total (1.1) violations of `f*` over all 140 cases | **0** |
| Total (1.3) violations of `f*` over all 140 cases | **0** |
| Cases where `f*` is a genuine `Φ`-minimizer | 140 / 140 |
| Overall verdict | **supported** |

### Baseline (a) — anchors

- **Example 4 (2-methylbutane, degrees (3,2,1,1,1)):** exactly **2** valid labellings;
  degree-1 class carries labels **{2,3,4}** with neighbour sums **{1,1,2}** (non-increasing
  in label); `f* = [0,1,3,4,2]`, `Φ_min = 34` (`c=2^i`). ✔ matches the paper.
- **Complete graphs `K_n`:** all degrees equal ⇒ (1.1) vacuous; every permutation is a
  valid labelling (`n!` of them), and `f*` is the identity. ✔
- **Paths `P_n`:** forced monotone-by-degree labelling; e.g. `P_4 → f*=[2,1,0,3]` with 2
  valid labellings, `P_5 → f*=[3,1,2,0,4]`. ✔
- **Stars `K_{1,n-1}`:** centre forced to label 0; all `(n-1)!` leaf orderings valid. ✔
- **Empty graphs:** no edges ⇒ every labelling degree-respecting and (1.3)-vacuous
  (`n!` valid). ✔

### Baseline (b) — Φ-minimizer correctness

For every case, `f*` is degree-respecting and attains the brute-force minimum of `Φ` over
`A` (recomputed independently in the smoke test). 140/140. ✔

### Baseline (c) — positive control

`f*` has **0** (1.1) and **0** (1.3) violations for all 140 `(G,c)`, including `c(i)=2^i`
and the nonlinear rational `c`. ✔

### Baseline (d) — negative control (engine is not vacuous)

- A degree-violating permutation (e.g. `[0,2,1,3,4]` on Example 4) is correctly rejected
  by (1.1) (1 violation). ✔
- Among degree-respecting labellings there exist **non-minimizers that violate (1.3)** —
  e.g. on Example 4 the degree-respecting labelling `[0,1,2,3,4]` has neighbour sums
  `(14,17,1,1,2)` and **2** violations of (1.3); on `C_5` the labelling `[0,1,2,3,4]` has
  **5** violations. These are rejected, confirming the (1.3) test genuinely discriminates. ✔

### Remark 3 equivalence (calculated)

Replacing `c(i)=2^i` with `c'(i)=2^{i+1}` (the `{1,...,n}`/`2^k` convention) scales every
neighbour sum and `Φ` by 2 and leaves `f*`, the valid-labelling set, and the count
unchanged — verified in the smoke test. ✔

### Per-graph valid-labelling counts (`c=2^i`, calculated)

| Graph | n | degree-respecting | valid | `f*` |
|---|---|---|---|---|
| example4_2methylbutane | 5 | 6 | **2** | 0,1,3,4,2 |
| K_1..K_6 | 1–6 | n! | n! | identity |
| P_1 | 1 | 1 | 1 | 0 |
| P_2 | 2 | 2 | 2 | 0,1 |
| P_3 | 3 | 2 | 2 | 1,0,2 |
| P_4 | 4 | 4 | 2 | 2,1,0,3 |
| P_5 | 5 | 12 | 2 | 3,1,2,0,4 |
| P_6 | 6 | 48 | 4 | 4,1,2,3,0,5 |
| P_7 | 7 | 240 | 4 | 5,1,3,2,4,0,6 |
| star_K1_1..K1_6 | 2–7 | (n-1)! | (n-1)! | 0,1,2,… |
| empty_1..empty_6 | 1–6 | n! | n! | identity |
| paw | 4 | 2 | 2 | 1,0,2,3 |
| diamond | 4 | 4 | 4 | 0,1,2,3 |
| C_4 | 4 | 24 | 8 | 0,2,1,3 |
| C_5 | 5 | 120 | 10 | 0,3,2,1,4 |
| C_6 | 6 | 720 | 24 | 0,4,2,3,1,5 |
| double_star | 6 | 48 | 8 | 2,1,0,3,4,5 |
| K2_3 | 5 | 12 | 12 | 0,1,2,3,4 |
| barbell | 6 | 48 | 8 | 2,5,0,1,3,4 |
| disconnected_2K2 | 4 | 24 | 8 | 0,3,1,2 |

The full 140-row table (all weights, `Φ_min`, neighbour sums, violation counts) is in
`results/per_case_results.csv`; machine-readable summary in `results/summary.json`.
Every row is labeled **calculated**.

## Stop-condition check

| Stop condition | Result |
|---|---|
| Any baseline fails | Not triggered (a–d all pass) |
| `f*` violates (1.3) on a genuine graph | Not triggered (0 violations) |
| Anchor mismatch | Not triggered (Example 4 = 2 valid, {2,3,4}/{1,1,2}) |
| Negative control vacuous | Not triggered (non-minimizer (1.3)-violations found) |

## Conclusion

The experiment **supports** Theorem 1 / Corollary 2: across 35 graphs and 4 strictly
increasing weight functions (including `c(i)=2^i` and a nonlinear rational `c`), the
edge-potential-minimizing degree-respecting labelling `f*` satisfies (1.1) and (1.3) with
**zero** violations, the anchors reproduce Example 4 exactly (two valid labellings, degree-1
labels {2,3,4}, sums {1,1,2}), and the negative control confirms the checker is not vacuous.
This is a finite exact check of the existence claim, not a disproof surface: the theorem's
proof stands independently.

## Files

- `sources.md` — references and definitions.
- `experiment.yaml` — signed hypothesis / baseline / metric / units / threshold / stop.
- `run.py` — model source (reproduction command).
- `test_smoke.py` — smoke tests.
- `results/per_case_results.csv` — all 140 cases (calculated).
- `results/summary.json` — machine-readable summary, anchors, negative controls.
- `report.md` — this report.

## Reproduction

```bash
# use python3 if python is unavailable
python experiments/degree-respecting-labelling-ordered-neighbour-sums/run.py
python experiments/degree-respecting-labelling-ordered-neighbour-sums/test_smoke.py
```

**Dependencies:** Python 3.8+ standard library only (`itertools`, `fractions`, `json`,
`csv`, `argparse`). All results are **calculated** with exact arithmetic.