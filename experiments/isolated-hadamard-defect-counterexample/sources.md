# Sources — Isolated Complex Hadamard Matrix with Nonzero Defect (BH(13,6), d(H)=1)

## Primary Source

- **Hall, S., & Nicoara, R. (2026), "An isolated complex Hadamard matrix with nonzero defect,"** arXiv:2611.20136 [math.CO]. DOI: 10.48550/arXiv.2611.20136.
  - Theorem 1.1 (pp. 1–2): Existence of isolated complex Hadamard matrix with nonzero defect.
  - Section 4 (pp. 11–14): Explicit matrix H ∈ BH(13,6) (entries 6th roots of unity) given as H_ij = w^{E_ij}, w = exp(πi/3), E in Eq. (matrixE).
  - Defect/span relation Eq. (1.3): d(H) = (n−1)² − dim_C[P,Q].
  - Proposition 3.2 (second-order isolation criterion) and Corollary 3.3: O_H(R) ≠ 0 on the generator R of T_H implies isolation.
  - Explicit calculations Proposition (Section 4): HH* = 13I, T_H = ℝR (so d(H) = 1), ∑R_ij³ = −3018, Tr(A³) = −538434 where A = (R∘H)H*, O_H(R) = −168/169 ≠ 0.
  - dim_C[D₁₃, uD₁₃u*] = 143 = (n−1)² − 1 (Eq. 1.3 with d(H)=1).

## Prior Work / Context

- **Banica–Özteke–Pittau Conjecture 1.8** (recorded as open in McNulty–Weigert 2026 review, Appendix B): Every isolated Hadamard matrix has defect zero, i.e., isolation ⇔ span condition dim_C[P,Q] = (n−1)².
- **Earlier order-99 claim** (Motta B_9^(0), defect 2): Shown NOT isolated (sits in a 2-parameter family), so did not refute the converse.
- **Lampio–Östergård–Szöllősi (LOS) classification**: The matrix H appears as line 394 of matrices/BH-13-6.txt in [LOSdata].

## Concepts and Conventions

- **Complex Hadamard matrix**: H ∈ M_n(ℂ), |H_ij| = 1, HH* = nI.
- **Butson type BH(n,k)**: Entries are k-th roots of unity. H ∈ BH(13,6).
- **Defect**: d(H) = dim_ℝ 𝒯_H, the real dimension of the linearized (first-order) deformation space of dephased Hadamard matrices (first row/column fixed to 1).
- **Span condition**: dim_C[P,Q] = (n−1)², where [P,Q] = span_ℂ{pq − qp} (commutator span). Eq. (1.3): d(H) = (n−1)² − dim_C[P,Q].
- **Isolation**: No inequivalent Hadamard matrix in a neighborhood; established here by sequential second-order method (Prop 3.2): if d(H) = 1 with generator R and O_H(R) ≠ 0, then H is isolated.
- **Second-order obstruction**: O_H(R) = Tr(A³)/n⁴ − ∑R_ij³/n² with A = (R∘H)H*, for R ∈ 𝒯_H.
- **Equivalence**: Row/column permutations and multiplication by unimodular scalars.
- **Dephased**: First row and column consist of 1's (achieved by equivalence).
- **Arithmetic**: Exact complex/cyclotomic (Eisenstein integer) arithmetic in ℤ[w] with w = exp(πi/3), w² = w − 1. Floating-point (complex128) with tight tolerance for verification.

## Constants

- n = 13 (matrix order).
- w = exp(πi/3) (primitive 6th root of unity).
- Fourier control: F_13 (order-13 discrete Fourier matrix, entries 13th roots of unity, d = 0).
- Expected invariants: d(H) = 1, dim_C[P,Q] = 143 < 144, O_H(R) = −168/169 ≠ 0.

## Notes

- All computations are performed in software only (Python + NumPy).
- No physical measurement, hardware, or real-world data collection is involved.
- Results are labeled **calculated** (exact rational/integer arithmetic in ℤ[w] via floating-point complex128 with rounding to nearest exact rational where applicable).