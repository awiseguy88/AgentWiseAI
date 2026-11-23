# Sources — Stable Schur Positivity Counterexample (Borcea-Brändén Problem 36)

## Primary Sources

- **Sra, S. (2026), "GPT, the Counterexample Machine," arXiv:2608.29595 [math.CO].** https://doi.org/10.48550/arXiv.2608.29595
  Section 3.2 (Theorem 3.7, Problem 36) gives the counterexample to Borcea–Brändén (2009) AIM Problem 36: "Let p be symmetric, real stable and homogeneous of degree d in n variables with d ≤ n and suppose p has at least one positive (and then all non-negative) coefficients in the monomial basis. Is p Schur-positive?" Answer: no, already at d = n = 5. Matrices J1..J5, leading principal minors, monomial expansion, and Schur expansion are given in Section 3.2 (proof of Theorem 3.7). Appendix C develops the construction (V = ker B ≅ S_(3,2), Ji = 2G(I + 5Pi)).

- **Borcea, J. and Brändén, P. (2009), "The Lee–Yang and Pólya–Schur programs. I. Linear operators preserving stability," Invent. Math. 177, 541–569.** https://doi.org/10.1007/s10240-009-0096-6
  Posed AIM Problem 36 (stable Schur positivity). See also the AIM problem list "Problems on polynomials with real zeros" (Problem 36).

## Concept / Model

- Symmetric real stable homogeneous polynomial q(x1,...,x5) = (1/648) det(Σ_{i=1}^5 xi Ji), with Ji symmetric positive definite 5×5 integer matrices.
- Monomial basis m_λ and Schur basis s_λ; Kostka matrix K_{λ,μ} (λ,μ ⊢ 5) invertible over ℤ.
- Real stability follows from Ji ≻ 0 (Sylvester); verified via leading principal minors Δ1..Δ5 > 0.
- Exact rational/integer arithmetic (Python fractions) so no float rounding affects the sign of [s_(1^5)]q.

## Constants and Conventions

- Degree d = 5, n = 5 variables.
- Normalization factor 1/648; det(Σ xi Ji) = 5184 p_5(x); q = 8 p_5(x).
- Leading principal minors Δ1..Δ5 (all positive) per Ji as listed in Section 3.2.
- Kostka matrix in partition order (5),(4,1),(3,2),(3,1,1),(2,2,1),(2,1,1,1),(1^5).

## Notes

- All computations are performed in software only (Python 3, exact integer/rational arithmetic).
- No physical measurement, hardware, or real-world data collection is involved.
- Results are labeled **calculated** (exact arithmetic; matrices and minors transcribed from the source).
- Companion source package (https://github.com/suvrit/count-ex-machina) recomputes the Schur expansion independently in rational arithmetic.
