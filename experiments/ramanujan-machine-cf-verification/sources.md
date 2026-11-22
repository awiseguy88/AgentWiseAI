# Sources — Ramanujan Machine Continued-Fraction Conjecture Verification

## Primary Source

- **R. Elimelech, O. David, C. De la Cruz Mengual, R. Kalisch, W. Berndt, M. Shalyt, M. Silberstein, Y. Hadad, I. Kaminer, "Algorithm-assisted discovery of an intrinsic order among mathematical constants," arXiv:2308.11829 (cs.AI), 2023; published in PNAS, DOI 10.1073/pnas.2321440121 (2024).**
  - arXiv: https://arxiv.org/abs/2308.11829
  - PDF: https://arxiv.org/pdf/2308.11829
  - PNAS: https://doi.org/10.1073/pnas.2321440121

## Locators in the Paper

- **Eq. (1) — Apéry zeta(3) CF (§1.2, page 2):**
  ```
  6/ζ(3) = 5 - 1⁶/(117 - 2⁶/(535 - 3⁶/(17(n³+(n+1)³) - 12(2n+1) - ...)))
  ```
  This is a proven CF for ζ(3) used as a validated control.

- **§2.3 / Appendix C.2 — DFR-discovered ζ(2) CF (Table 3, α = 5):**
  The paper presents an infinite family with `aₙ = n² + (n+1)² + α(α−1)`, `bₙ = -n⁴`.
  For `α = 5`, this gives `aₙ = n² + (n+1)² + 20`, `bₙ = -n⁴`.
  The specific conjectured CF evaluated in this experiment uses the simpler degree-1
  variant with numerators `n²` (not `n⁴`) as transcribed from the DFR output and
  explicitly listed in the issue:
  ```
  72/(72·ζ(2) - 115) = 2 - 1²/(25 - 1²/(16 - 2²/(33 - 3²/(52 - ...))))
  ```
  where the tail general term is `n²/(n² + (n+1)² + 20)` for n ≥ 2.

- **Appendix B "Verification of results" (B.1 approximation error, B.2 PSLQ over-fit):**
  The authors warn that PSLQ can produce over-fitted formulas matching a constant
  to a few digits by coincidence, so increasing truncation depth is the critical test.

- **Appendix C.3 (Table 4) — Sporadic formulas for higher ζ values:** includes further
  DFR-discovered CFs with factorial reduction.

## Constants

- ζ(2) = π²/6 = 1.64493406684822643647...
- ζ(3) = 1.2020569031595942854... (Apéry's constant)

## Verification Approach

Both CFs are evaluated by truncating at depth N (N = 1…200) and computing the
convergent using arbitrary-precision arithmetic (mpmath). The absolute error
vs. the true constant and the number of agreeing decimal digits are recorded
per depth.

The Apéry CF serves as a control: it must reach ≥ 12 correct digits at depth 200
to confirm the evaluation method works. The DFR ζ(2) CF is the primary claim
under test: it must reach ≥ 10 correct digits at depth 200 with monotonically
decreasing error.