# Sources

## Primary
- **Verbree & Cherukuri (2023)** — *Wardrop equilibrium and Braess's paradox for varying demand*.
  - DOI: https://doi.org/10.48550/arxiv.2310.04256
  - arXiv: 2310.04256
  - Relevance: Establishes theoretical result that a path causing Braess's paradox at a particular demand must be strictly beneficial at a lower demand; motivates existence of a critical demand threshold D* separating beneficial/neutral and paradox regimes for varying demand.

## Supporting
- **Gisches & Rapoport (2010)** — *Degrading network capacity may improve performance: experimental evidence* (experimental verification related to Braess paradox behavior in route-choice games).
  - DOI: https://doi.org/10.1007/s11238-010-9237-0
  - Relevance: Supporting experimental context for Braess-paradox effects in network routing behavior.

- **Braess (1968)** — *Über ein Paradoxon aus der Verkehrsplanung*; English translation: *On a Paradox of Traffic Planning*.
  - English translation DOI: https://doi.org/10.1287/trsc.1050.0127 (Transportation Science 39(4):446-450, 2005)
  - Relevance: Classic reference defining the Braess paradox network and the counterintuitive increase in equilibrium travel cost from adding a link.

## Standard network parameterization (used in this experiment)
- Nodes: S, A, B, T. Demand D flows S→T.
- Edges without central link: S→A cost `f`, A→T cost `50`, S→B cost `50`, B→T cost `f`.
- Added central link (proposed model): A→B cost `1`.
- Affine edge costs `c_e(f)=a_e*f+b_e`, Wardrop user equilibrium (non-atomic selfish routing).
- Analytical equilibrium (standard): without edge total cost `D*(D/2 + 50)`; with edge total cost `D*(2D+1)` for `D<=49`, `99D` for `49<D<98`, `D*(D/2 + 50)` for `D>=98` (calculated). Paradox onset at `D*=98/3≈32.6667` where costs equal (`3D^2/2 - 49D = 0`); paradox vanishes at `D=98` where costs re-cross (`D^2/2 - 49D = 0`).

All numerical results in this experiment are labeled **simulated** (Beckmann potential minimization via SciPy SLSQP) or **calculated** (closed-form analytical solution) as indicated in outputs.
