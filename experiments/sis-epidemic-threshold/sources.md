# Sources — SIS Epidemic Threshold on Random Regular Graphs (Finite-Size Correction)

## Primary Sources

- **R. Pastor-Satorras, C. Castellano, P. Van Mieghem, A. Vespignani, "Epidemic processes in complex networks", Rev. Mod. Phys. 87, 925 (2015).** https://doi.org/10.1103/RevModPhys.87.925
  Review of epidemic processes on complex networks. Mean-field / NIMFA-style approximations predict an SIS epidemic threshold for degree-homogeneous networks related to the leading eigenvalue of the adjacency matrix: τ_c = μ / λ_1(A). For a random *d*-regular graph, λ_1(A) = d, giving the quenched mean-field threshold τ_c,MF = μ/d. The review also discusses the homogeneous/degree-based approximation 1/(d-1) and finite-size and stochastic effects that shift/blur the effective threshold.

- **Y. Wang, D. Chakrabarti, C. Wang, C. Faloutsos, "Epidemic spreading in real networks: an eigenvalue viewpoint", Phys. Rev. E 66, 016128 (2003).** https://doi.org/10.1103/PhysRevE.66.016128
  Original NIMFA-style result: the SIS epidemic threshold is determined by the largest eigenvalue of the adjacency matrix, τ_c = 1/λ_1(A). For regular graphs λ_1(A) = d, so τ_c = 1/d.

## Concept / Model

Continuous-time SIS (Gillespie) on a graph G = (V, E):

- Each node is Susceptible (S) or Infected (I).
- Infection: each infected node *i* attempts to infect each *susceptible* neighbor at rate τ (per-edge infection rate).
- Recovery: each infected node recovers to susceptible at rate μ (fixed, μ = 1).
- Total transition rate R = τ·C + μ·I, where C is the number of directed edges from infected to susceptible nodes (the cut between infected and susceptible sets) and I is the number of infected nodes.
- Gillespie direct method: choose next event with probability proportional to rate; infection event picks a uniformly random directed infected→susceptible edge and infects its target; recovery event picks a uniformly random infected node and recovers it.

For a random *d*-regular graph with *d* = 3 and μ = 1:

- **Quenched mean-field (spectral) threshold:** τ_c = μ/λ_1(A) = 1/d = 1/3 ≈ 0.333.
- **Homogeneous / degree-based approximation (1/(d-1)):** τ_c ≈ 1/(d-1) = 1/2 = 0.5. This is the value used as the experiment's baseline (per the issue), corresponding to a tree-like / cascade branching argument where each infected node has d−1 "forward" neighbors.
- The **hypothesis under test** is that the *measured* effective threshold τ_c^eff(N) estimated from the quasistationary infected-fraction curve moves toward **0.5** as N increases and is within ±0.03 by N = 4000.

## Prior Work

- Pastor-Satorras et al. (2015) and Wang et al. (2003): SIS threshold = μ/λ_1(A); for d-regular graphs λ_1 = d → τ_c = 1/d.
- The homogeneous approximation 1/(d-1) is a common mean-field estimate that ignores the leading eigenvalue being d (it counts only d−1 "forward" neighbors in a locally tree-like branching picture).
- Finite-size and stochastic effects are known qualitatively to shift/blur the effective threshold; a small, reproducible software experiment quantifying τ_c^eff(N, d) and its approach to a mean-field value across finite N is the verification gap.

## Constants and Conventions

- Degree d = 3 (random 3-regular graphs).
- Recovery rate μ = 1 (fixed).
- Infection rate τ varied over a grid; dimensionless (τ = infection rate / recovery rate).
- N ∈ {500, 1000, 2000, 4000} node counts.

## Notes

- All computations are performed in software only (Python + NumPy + NetworkX).
- No physical measurement, hardware, or real-world data collection is involved.
- All results are labeled **simulated** (stochastic Gillespie simulation).