# Sources

## Primary
- **Mallein, Paparella, Schertzer, Talyigás (2025/2026)** — *Selection of the fittest or selection of the luckiest: the emergence of Goodhart's law in evolution*.
  - arXiv: [2503.21849v2](https://arxiv.org/abs/2503.21849v2)
  - DOI: https://doi.org/10.48550/arXiv.2503.21849
  - Relevance: Proposes and analyzes a minimal stochastic evolution model in which selection acts on noisy phenotypic expressions of heritable genotypes. For the Laplace noise case (α=1), the rate of adaptation V increases with selection pressure (decreasing γ) only up to a critical threshold γ_c(μ); beyond this threshold (γ < γ_c(μ), stronger selection) adaptation slows and genetic diversity is reduced — a biological instance of Goodhart's law. Key figures: Figure 1 (Laplace case, N=10^5) showing scaled adaptation rate and effective population size as functions of γ and μ.

## Supporting
- **Goodhart, C. A. E. (1975)** — *Problems of Monetary Management: The U.K. Experience*. Papers in Monetary Economics, Reserve Bank of Australia.
  - Relevance: Original formulation of Goodhart's law ("When a measure becomes a target, it ceases to be a good measure"), providing the conceptual analogy used by the primary source.

## Model specification used in this experiment (simulated)
- Population: asexual, discrete generations, fixed size N (primary N=50000 for feasible reproduction; supplementary scaling noted in report).
- Genotypic noise (mutation): X ~ Laplace(0, 1), offspring genotype = parent genotype + X.
- Phenotypic noise: Y ~ Laplace(0, μ), phenotype = genotype + Y; μ is the phenotypic-to-genotypic noise ratio.
- Selection: top K = round(N^γ) individuals by phenotype reproduce; each produces N/K offspring (deterministic split with uniform residual assignment), low γ = high selection pressure.
- Baseline (no genotype-phenotype mismatch): μ = 0 (phenotype = genotype exactly).
- Scaled adaptation rate: V_scaled = V / log(N), V = (mean genotype at final generation − mean genotype at generation 0) / ngen, averaged over independent runs.
- Effective population size: N_e = mean time to most recent common ancestor (T_2) of two randomly sampled individuals, estimated by genealogy tracking (simulated).

All numerical results in this experiment are labeled **simulated**. No physical measurements were performed.
