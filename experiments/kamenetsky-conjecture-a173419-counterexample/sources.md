# Sources — Counterexample to Kamenetsky's Conjecture on OEIS A173419

## Primary Sources

- **R. Patanè, "Counterexamples to a conjecture of Kamenetsky on OEIS A173419", arXiv:2609.28512 [math.GM] (2026).** https://doi.org/10.48550/arXiv.2609.28512 · https://arxiv.org/abs/2609.28512
  Disproves Kamenetsky's conjecture (a(n) >= a(n-1) for every prime n) with four counterexamples below 5000: 3359, 3623, 4909, 4943. Provides explicit upper-bound chains and a self-contained verification script verify.py (Python standard library).
- **OEIS A173419 — "Length of shortest computation of n using +, -, * starting from 1" (Charles R Greathouse IV, 2010).** https://oeis.org/A173419
  Defines a(n): set x_0 = 1; each x_k = x_i + x_j, x_i * x_j, or x_i - x_j for 0 <= i, j < k; a(n) is the least m with x_m = n. B-file published values a(1)..a(108) used as the reference control.

## Concept / Model

- A computation (addition-subtraction chain) for n: a sequence x_0 = 1, ..., x_m = n where each entry is obtained from two earlier entries by addition, subtraction, or multiplication; entries may be reused (0 <= i, j < k).
- a(n) is the least length m of such a chain.
- Kamenetsky's conjecture (December 2019 OEIS comment): a(p) >= a(p-1) for every prime p; noted to hold for all primes p < 1800.
- Patanè (2026): at p = 3359, chain 1,2,4,16,15,225,3375,3359 gives a(3359) <= 7 while a(3358) >= 8, so a(3359) < a(3358) — a violation.

## Prior Work

- D. Kamenetsky, comment on OEIS A173419 (December 2019): conjecture a(n) >= a(n-1) for prime n, verified for n < 1800.
- R. Patanè (2026), arXiv:2609.28512: four counterexamples below 5000 (3359, 3623, 4909, 4943); source code at https://github.com/patan3saro/A173419-counterexample with verify.py.

## Constants and Conventions

- Start value x_0 = 1 (fixed).
- Allowed operations per step: x_i + x_j, x_i * x_j, x_i - x_j (positive results only).
- Depth = number of operations (chain length minus 1), dimensionless integer.
- Values of interest: a(3359), a(3358), and reference recomputation a(1)..a(108).
- All values are dimensionless integer operation counts; no physical units.

## Notes

- All computations are performed in software only (Python 3, standard library).
- No physical measurement, hardware, or real-world data collection is involved.
- The explicit chains establish upper bounds (calculated, validated step by step).
- The lower bounds (no chain of depth <= 6 for 3359; no chain of depth <= 7 for 3358) come from exhaustive enumeration (simulated).
- All results are labeled **calculated** (explicit chains, exact integer checks) or **simulated** (exhaustive enumeration) in report.md.
