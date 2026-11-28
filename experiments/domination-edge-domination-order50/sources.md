# Sources — Domination-versus-Edge-Domination Conjecture Counterexample (50-Vertex Cubic Graph)

## Primary Sources

- **K. Afrasyab, "A 50-Vertex Cubic Counterexample to the Domination-versus-Edge-Domination Conjecture," arXiv:2609.10783 [math.CO] (2026).** DOI: [10.48550/arXiv:2609.10783](https://doi.org/10.48550/arXiv:2609.10783). Submitted 9 Sep 2026.
  - **Theorem 1 (Section 1):** there exists a connected cubic graph G on 50 vertices with γ(G) = 16 > 15 = γ_e(G), so the Domination-versus-Edge-Domination Conjecture is false already for Δ = 3.
  - **Section 2 (the graph):** G is the public 50-vertex formula-incidence graph — 20 clause vertices c₁..c₂₀, 30 literal vertices v₁⁻,v₁⁺..v₁₅⁻,v₁₅⁺, 75 edges, cubic; labeling v_j⁻ = 2(j−1), v_j⁺ = 2(j−1)+1, c_a = 29+a; edge list `counterexample.edgelist`; clauses listed in Section 2.
  - **Section 3 (Proposition 2):** γ_e(G) = 15 — maximal matching M = {v_j⁻v_j⁺ : 1 ≤ j ≤ 15} of size 15, with lower bound 75/5 = 15.
  - **Section 4:** explicit dominating set D₀ of order 16 (listed numerically {0,2,5,7,8,13,15,30,31,32,33,35,37,42,46,48}) → γ(G) ≤ 16.
  - **Sections 5–6:** exact finite lower bound γ(G) ≥ 16 by enumerating all 2²⁰ = 1,048,576 clause subsets, two exact lower bounds, and an exact recurrence solving the 5,931 residual cases.
  - **Section 7:** independent machine verification via an 893,049-node proof-tree certificate and a direct branch-and-bound search.
  - **Appendix A:** standard-library Python reproduction code (`paper_audit.py`).

- **Baste, Fürst, Henning, Mohr, Rautenbach (2019/2020):** the Domination-versus-Edge-Domination Conjecture — every Δ-regular graph with Δ ≥ 1 satisfies γ(G) ≤ γ_e(G). The graph G refutes this for Δ = 3.

- **Gupta (2026):** proves the conjecture for every cubic graph on at most 48 vertices; G is therefore the order-minimal cubic counterexample.

## Concept / Model

A graph G = (V, E) is finite, simple, undirected.

- A **dominating set** D ⊆ V: every vertex belongs to D or has a neighbor in D. The **domination number** γ(G) = min |D| over dominating sets D.
- An **edge-dominating set** F ⊆ E: every edge shares an endpoint with some edge in F. The **edge domination number** γ_e(G) = min |F|, equivalently the minimum cardinality of a maximal matching.
- **D dominates** iff every vertex is in D or adjacent to D.
- **Edge-dominating set F** iff every edge shares an endpoint with some edge in F.
- γ_e equals the minimum size of a maximal matching.

## Prior Work

- Baste et al. (2019/2020) conjectured γ(G) ≤ γ_e(G) for every regular graph.
- Gupta (2026) proved the conjecture for all cubic graphs of order ≤ 48 and for all regular graphs of degree ≥ 7.
- TxGraffiti (2026) released the public 50-vertex formula-incidence graph as a counterexample to the stronger independent-domination inequality i(G) ≤ γ_e(G); since γ(G) ≤ i(G), that result alone did not decide the Baste et al. conjecture. Afrasyab's contribution is the determination that the same graph has ordinary domination number 16.

## Constants and Conventions

- |V| = 50, |E| = 75, degree = 3 (cubic), connected.
- Labeling: v_j⁻ = 2(j−1), v_j⁺ = 2(j−1)+1 (j = 1..15); c_a = 29+a (a = 1..20).
- D₀ = {0,2,5,7,8,13,15,30,31,32,33,35,37,42,46,48} (size 16).
- M = {(0,1),(2,3),(4,5),...,(28,29)} (size 15).
- Exact integer arithmetic; all cardinalities are dimensionless.

## Notes

- All computations are performed in software only (Python 3 standard library). No physical measurement, hardware, or real-world data collection is involved.
- The graph is transcribed exactly from `counterexample.edgelist` / `counterexample.json` (the arXiv:2609.10783 ancillary package), which is the public TxGraffiti graph; the experiment reproduces the paper's finite calculation rather than discovering the graph.
- Results are labeled **calculated** (exact deterministic finite computation, no randomness, no measurement).