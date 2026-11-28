# Sources

## Primary
- **Ishikawa, T. & Uda, T. (2026)** — *Degree-respecting labellings with ordered neighbour sums*.
  - arXiv: 2611.34269v1 [math.CO], submitted 25 Nov 2026.
  - DOI: https://doi.org/10.48550/arXiv.2611.34269
  - Abstract page: https://arxiv.org/abs/2611.34269 (HTML: https://arxiv.org/html/2611.34269v1)
  - Relevance: Proves the existence statement this experiment reproduces. For every
    finite simple graph `G=(V,E)` with `|V|=n`, label set `I_n={0,...,n-1}`, and any
    strictly increasing `c:I_n→R`, there is a bijection `f:V→I_n` satisfying both
    the degree condition (1.1) and the equal-degree neighbour-sum condition (1.3).

## Definitions reproduced (Section 1 / Section 2 of the paper)
- **Label set:** `I_n = {0, 1, ..., n-1}`; a *labelling* is a bijection `f: V → I_n`.
- **Degree condition (1.1):** `d(v) < d(w) ⟹ f(w) < f(v)` (larger degree ⇒ smaller label).
- **Equal-degree neighbour-sum condition (1.3):** if `d(v) = d(w)` and `f(w) < f(v)` then
  `Σ_{u∈N(v)} c(f(u)) ≤ Σ_{u∈N(w)} c(f(u))`.
- **Edge potential (Section 2, Eq. 2.1):** `Φ(g) = Σ_{{x,y}∈E} c(g(x))·c(g(y))`.
- **Theorem 1 (existence):** among the finite nonempty set `A` of degree-respecting
  labellings, any `f` minimizing `Φ` over `A` satisfies (1.1) and (1.3). The proof is a
  single label-exchange argument on a violating equal-degree pair (Eq. 2.2): swapping the
  two labels cannot increase `Φ`, contradicting minimality.
- **Corollary 2:** the special case `c(i) = 2^i` (the hydrocarbon-enumeration pruning rule).
- **Remark 3:** the `{1,...,n}` convention with weights `2^k` is exactly `2×` the `I_n`
  convention, so neither (1.1) nor (1.3) changes; the two conventions are equivalent.
- **Example 4 (Fig. 1):** 2-methylbutane skeleton (4 carbons, the unique tree with degree
  sequence `(3,1,1,1)` on 4 vertices is the star `K_{1,3}`; the paper's 2-methylbutane
  skeleton is that star) has exactly two valid labellings; the degree-1 class carries
  labels `{2,3,4}` with neighbour sums `(2,1,1)` non-increasing.

## Notes on independent reproduction
- The paper mentions a Lean 4 check and brute-force valid-labelling counts for carbon
  skeletons on 2–7 carbons but releases **no verification code or data**. This experiment
  is an independent software reproduction of the *existence* claim only.
- All arithmetic is exact: Python `int` for `c(i)=2^i` and `c(i)=i`, and
  `fractions.Fraction` for rational / real weights, so (1.1), (1.3) and `Φ` are checked
  with no floating-point error.
- Every numeric result in `results/` and `report.md` is labeled **calculated** (exact
  finite computation), never simulated or measured.