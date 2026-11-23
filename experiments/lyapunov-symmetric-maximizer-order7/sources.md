# Sources — Symmetric-Maximizer Conjecture Counterexample for Lyapunov Operators (Order 7)

## Primary Source

- **D. Kressner, B. Vandereycken, "A counterexample to the symmetric-maximizer conjecture for Lyapunov operators", arXiv:2608.20875v1 [math.NA], 21 Aug 2026.** https://arxiv.org/abs/2608.20875 — DOI: 10.48550/arXiv.2608.20875

  Gives an explicit integer matrix A of order 7 (Theorem 2, Eq. 4) for which the skew-symmetric restricted norm of the Lyapunov operator L_A(X) = AX + XA^T strictly exceeds the symmetric restricted norm. Provides a rational separator (1196) and an exact-arithmetic certificate M_S = 1196 D_S − B_S^T D_S B_S = L diag(d_1..d_28) L^T with all pivots d_i ≥ 82 (Eq. 7–9). Direct-sum construction (Corollary 4) extends counterexamples to every order n ≥ 7.

## Values Used (with source location)

| Value | Source location in arXiv:2608.20875 |
|---|---|
| Integer matrix A (order 7) | Theorem 2, Eq. 4 (page 2) |
| Skew-symmetric witness K | Theorem 2 proof (page 3) |
| ‖K‖_F^2 = 53836 | Theorem 2 proof, Eq. (9) (page 3) |
| ‖L_A(K)‖_F^2 = 64387950 | Theorem 2 proof, Eq. (9) (page 3) |
| Separator 1196 | Theorem 2, Eq. (5) and proof Eq. (7) (pages 2–3) |
| Gram matrices D_S = diag(I_7, 2 I_21), D_K = 2 I_21 | Theorem 2 proof (page 2) |
| Coordinate matrices B_S ∈ Z^28×28, B_K ∈ Z^21×21 | Theorem 2 proof (page 2) |
| Certificate M_S = 1196 D_S − B_S^T D_S B_S ≻ 0, pivots d_i ≥ 82 | Theorem 2 proof, Eq. (7)–(8) (pages 2–3) |
| Float64 ‖L_A|_S7‖² ≈ 1195.593985, ‖L_A|_K7‖² ≈ 1196.025224 | Remark 3 (page 3) |
| Conjecture holds for n ≤ 5 | Introduction (page 1), citing Chen & Tian 2015 [CT15] |
| Case n = 6 open | Conclusion (page 5) |

## Prior Work / Context

- The symmetric-maximizer conjecture (Byers & Nash 1987; formulated by Chen & Tian 2015) states ‖L_A|_K_n‖ ≤ ‖L_A|_S_n‖ for every A; known to hold for n ≤ 5 [CT15], open for n ≥ 6 as of 2021 [KT21].
- Kressner & Vandereycken disprove it for every n ≥ 7 via this exact order-7 certificate; n = 6 remains the only unresolved dimension.

## Notes

- All computations are performed in software only (Python 3, exact integer/rational arithmetic via `fractions`, float64 controls via NumPy/SciPy).
- No physical measurement, hardware, or real-world data collection is involved.
- Results are labeled **calculated** (exact arithmetic derivation from the published integer matrices).
