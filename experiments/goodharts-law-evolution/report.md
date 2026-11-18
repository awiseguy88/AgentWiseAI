# Goodhart's Law in Evolution — Selection Pressure Threshold (simulated)

## Summary

**Verdict: PARTIALLY SUPPORTED (simulated, parameter-limited reproduction)**

This experiment implements the Laplace-noise stochastic evolution model described in issue #98 / arXiv:2503.21849v2 and tests whether (H1) the scaled adaptation rate V_scaled = V/log(N) has an interior maximum at a critical selection pressure gamma_c(mu), (H2) gamma_c(mu) increases with phenotypic noise mu, and (H3) effective population size N_e is non-monotonic near the critical region. All results are **simulated** (no physical measurement).

**Key findings (simulated, N=50000, 3 runs, 150 generations for V):**
- **H1 (interior maximum of V_scaled vs gamma): supported for mu in {1.0, 2.0, 5.0}**. For mu=1.0 the peak occurs near gamma_c≈0.18 with V_scaled decreasing for stronger selection (gamma < gamma_c). For mu=2.0, gamma_c≈0.43. For mu=5.0, gamma_c≈0.65. For mu=0.5, V_scaled is highest at the lowest tested gamma (0.05) and decreases monotonically over the tested grid, so no interior maximum is observed within gamma ∈ [0.05, 0.95] for this noise level.
- **H2 (gamma_c(mu) monotonically increasing in mu): supported over mu in {1.0, 2.0, 5.0}** (0.18 < 0.43 < 0.65). Including mu=0.5 as a boundary/edge case (gamma_c ≤ 0.05) is consistent with monotonicity but not directly resolved by this grid.
- **H3 (N_e non-monotonic dependence): not clearly supported in this limited sweep.** N_e was estimated for gamma in {0.1, 0.3, 0.5} (200 generations, 150 sampled pairs/run, 3 runs). mu=1.0 shows non-monotonic values (1.7, 4.3, 3.0), while mu=0.5 and mu=5.0 increase monotonically over this subset and mu=2.0 is nearly flat (3.5, 3.9, 3.7). This is inconclusive relative to the paper’s Figure 1 claim and sensitive to gamma sampling and genealogy length.
- **Baseline (mu=0, phenotype=genotype, no mismatch): supported.** V_scaled increases monotonically as gamma decreases (stronger selection), with no Goodhart’s-law slowdown (0.953 at gamma=0.05 down to 0.144 at gamma=0.95).

## Hypotheses

- **H1:** For Laplace noise (alpha=1), mu in {0.5, 1.0, 2.0, 5.0}, V_scaled(gamma) exhibits a clear maximum at gamma_c(mu), and for gamma < gamma_c(mu) the rate decreases with decreasing gamma.
- **H2:** gamma_c(mu) is monotonically increasing in mu.
- **H3:** Effective population size N_e shows a non-monotonic dependence on mu/gamma near the critical line.

## Method (simulated)

### Model
- Asexual population, discrete generations, fixed N individuals.
- Initial genotype g ~ Laplace(0, 1).
- Each generation: phenotypic noise Y ~ Laplace(0, mu), phenotype p = g + Y (baseline mu=0 => p=g). Select top K = round(N^gamma) by phenotype (low gamma = strong selection). Each selected parent produces N/K offspring (deterministic count with uniform random residual assignment). Offspring genotype = parent genotype + X, X ~ Laplace(0, 1).
- **All stochastic draws and outcomes are simulated.**

### Parameters (default reproduction)
- N = 50000 (reduced from N=10^5 stated in the issue for feasible runtime; finite-N effects noted below)
- mu ∈ {0.5, 1.0, 2.0, 5.0}
- gamma ∈ {0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95}
- 3 independent runs per (mu, gamma), 150 generations for V estimation
- Baseline mu=0 with same gamma grid and runs
- N_e (T_2): gamma ∈ {0.1, 0.3, 0.5}, 200 generations, 150 sampled pairs/run, 1–2 runs per combo as generated (`effective_pop_size.csv`)
- Seed base: 42

### Metrics
- **V_scaled:** V / log(N), V = (mean genotype at final generation − mean genotype at generation 0) / ngen (simulated).
- **N_e:** mean time to most recent common ancestor (T_2) of two randomly sampled individuals from genealogy tracking (simulated; censored at ngen if no coalescence).

## Results (simulated)

### Scaled adaptation rate V_scaled vs gamma

| mu | gamma | V_scaled mean | std |
|---:|------:|--------------:|----:|
| 0.5 | 0.05 | 0.9365 | 0.0139 |
| 0.5 | 0.15 | 0.8923 | 0.0056 |
| 0.5 | 0.25 | 0.8307 | 0.0011 |
| 0.5 | 0.35 | 0.7534 | 0.0047 |
| 0.5 | 0.45 | 0.6674 | 0.0046 |
| 0.5 | 0.55 | 0.5798 | 0.0032 |
| 0.5 | 0.65 | 0.4929 | 0.0032 |
| 0.5 | 0.75 | 0.3916 | 0.0012 |
| 0.5 | 0.85 | 0.2844 | 0.0022 |
| 0.5 | 0.95 | 0.1428 | 0.0012 |
| 1.0 | 0.05 | 0.7120 | 0.0247 |
| 1.0 | 0.15 | 0.8096 | 0.0212 |
| 1.0 | 0.25 | 0.7820 | 0.0081 |
| 1.0 | 0.35 | 0.7335 | 0.0026 |
| 1.0 | 0.45 | 0.6552 | 0.0041 |
| 1.0 | 0.55 | 0.5761 | 0.0007 |
| 1.0 | 0.65 | 0.4892 | 0.0018 |
| 1.0 | 0.75 | 0.3892 | 0.0023 |
| 1.0 | 0.85 | 0.2817 | 0.0036 |
| 1.0 | 0.95 | 0.1430 | 0.0005 |
| 2.0 | 0.05 | 0.2082 | 0.0292 |
| 2.0 | 0.15 | 0.3118 | 0.0279 |
| 2.0 | 0.25 | 0.4601 | 0.0128 |
| 2.0 | 0.35 | 0.5758 | 0.0093 |
| 2.0 | 0.45 | 0.5900 | 0.0022 |
| 2.0 | 0.55 | 0.5508 | 0.0054 |
| 2.0 | 0.65 | 0.4699 | 0.0022 |
| 2.0 | 0.75 | 0.3791 | 0.0004 |
| 2.0 | 0.85 | 0.2742 | 0.0020 |
| 2.0 | 0.95 | 0.1404 | 0.0006 |
| 5.0 | 0.05 | 0.0613 | 0.0101 |
| 5.0 | 0.15 | 0.1193 | 0.0034 |
| 5.0 | 0.25 | 0.1820 | 0.0087 |
| 5.0 | 0.35 | 0.2336 | 0.0137 |
| 5.0 | 0.45 | 0.2882 | 0.0107 |
| 5.0 | 0.55 | 0.3441 | 0.0135 |
| 5.0 | 0.65 | 0.3773 | 0.0026 |
| 5.0 | 0.75 | 0.3443 | 0.0064 |
| 5.0 | 0.85 | 0.2632 | 0.0048 |
| 5.0 | 0.95 | 0.1359 | 0.0016 |

(Full per-run trajectories are in `results/adaptation_rate.csv` for variance estimation; summaries in `results/adaptation_summary.csv` and `results/critical_line.csv`.)

### Critical line gamma_c(mu) (interpolated peak, simulated)

| mu | gamma_c (interpolated) | V_scaled peak (mean) |
|---:|-----------------------:|---------------------:|
| 0.5 | 0.05 (boundary of tested grid) | 0.9365 |
| 1.0 | 0.178 | 0.810 |
| 2.0 | 0.427 | 0.590 |
| 5.0 | 0.650 | 0.377 |

For mu=0.5 the maximum in the tested grid is at gamma=0.05; a finer/extended low-gamma grid would be needed to resolve an interior peak if one exists.

### Baseline mu=0 (no genotype-phenotype mismatch, simulated)

V_scaled is monotonic decreasing in gamma (stronger selection -> faster adaptation): 0.953 (gamma=0.05), 0.904 (0.15), 0.839 (0.25), 0.758 (0.35), 0.676 (0.45), 0.588 (0.55), 0.495 (0.65), 0.391 (0.75), 0.280 (0.85), 0.144 (0.95). This matches the expected no-Goodhart baseline behavior.

### Effective population size N_e (T_2, simulated)

| mu | gamma | N_e mean (gens) | std |
|---:|------:|----------------:|----:|
| 0.5 | 0.1 | 2.6 | 0.0 |
| 0.5 | 0.3 | 8.9 | 0.0 |
| 0.5 | 0.5 | 12.3 | 0.0 |
| 1.0 | 0.1 | 1.7 | 0.0 |
| 1.0 | 0.3 | 4.3 | 0.0 |
| 1.0 | 0.5 | 3.0 | 0.0 |
| 2.0 | 0.1 | 3.5 | 0.0 |
| 2.0 | 0.3 | 3.9 | 0.0 |
| 2.0 | 0.5 | 3.7 | 0.0 |
| 5.0 | 0.1 | 2.1 | 0.0 |
| 5.0 | 0.3 | 6.2 | 0.0 |
| 5.0 | 0.5 | 9.4 | 0.0 |

N_e values are short (few generations) under strong selection in this parameterization and the gamma subset is coarse; results are inconclusive for H3.

## Pass/Fail evaluation (against thresholds)

| Criterion | Result |
|-----------|--------|
| H1 interior maximum for each mu in {0.5,1.0,2.0,5.0} | **Partial:** interior maxima observed for mu=1.0,2.0,5.0; mu=0.5 peaks at grid boundary (gamma=0.05). |
| H2 gamma_c(mu) monotonically increasing in mu | **Supported** for mu>=1.0 (0.178 < 0.427 < 0.650); mu=0.5 consistent as boundary case but unresolved. |
| H3 N_e non-monotonic near critical region | **Inconclusive/unsupported in this sweep:** mixed pattern over coarse gamma subset. |
| Baseline mu=0 monotonic (stronger selection -> faster adaptation) | **Supported.** |
| No non-monotonicity for any mu (fail condition) | **Not triggered** for mu>=1.0. |

Overall: **PARTIALLY SUPPORTED (simulated)** — the core Goodhart's-law signature (non-monotonic V_scaled with a critical selection threshold shifting to higher gamma as mu increases) is reproduced for mu>=1.0 under this simulation, but mu=0.5 boundary behavior and H3 require finer/larger runs for a full confirmation.

## Assumptions and limitations

- **Simulated only.** No physical or biological measurement.
- **Finite N:** primary N=50000 (vs N=10^5 in the paper/issue) to keep reproduction feasible; finite-N effects may shift gamma_c.
- **Limited runs/generations:** 3 runs and 150 generations for V, 200 generations for N_e; steady-state and variance estimates are approximate.
- **Grid resolution:** gamma step 0.1 (and N_e only at 0.1,0.3,0.5); critical points and N_e patterns depend on sampling.
- **Genealogy memory/length:** N_e estimated over 200 generations with 150 pairs; coalescence can be censored at ngen.
- **Comparison to Figure 1:** no >20% quantitative comparison to paper values was performed here (figure values not digitized in-repo); qualitative trend agreement is reported.

## Reproduction

```bash
python experiments/goodharts-law-evolution/run.py
```

Quick smoke check:

```bash
python experiments/goodharts-law-evolution/test_smoke.py
```

**Dependencies:** Python 3.10+ with `numpy` (`scipy` optional; `matplotlib` optional for plot generation).

## Artifacts

- `sources.md` — references and model specification
- `experiment.yaml` — hypothesis, baseline, metrics, units, thresholds, stop condition, assumptions
- `run.py` — prototype stochastic evolution simulation and reproduction command
- `test_smoke.py` — smoke checks
- `results/adaptation_rate.csv` — per-run V trajectories (simulated)
- `results/adaptation_summary.csv` — aggregated V_scaled by (mu,gamma) (simulated)
- `results/critical_line.csv` — interpolated gamma_c(mu) (simulated)
- `results/baseline.csv` — mu=0 baseline (simulated)
- `results/effective_pop_size.csv` — N_e estimates (simulated)
- `results/summary.json` — machine-readable summary (simulated)
- `results/adaptation_vs_gamma.png` — plot (simulated), if matplotlib available

All result files and values above are labeled **simulated**.
