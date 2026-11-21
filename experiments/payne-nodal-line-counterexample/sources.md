# Sources — Payne Nodal Line Conjecture Counterexample

## Primary Sources

- **Dähne, K.** "A numerical counterexample to Payne's nodal line conjecture." Numerical computation of the second Neumann eigenfunction on a 2D domain with six holes, showing a closed (interior) nodal line that does not touch the boundary — a numerical rejection of Payne's conjecture.
  - Numerical result; no physical measurement. Cited as the Dähne reference domain (six holes, closed interior nodal line).

- **Mattfeldt, T. & Kleefeld, A. (2026).** "Investigating parameter dependence for counterexamples to Payne's nodal line conjecture using HPC." arXiv:2611.12542. DOI: 10.48550/arXiv.2611.12542. https://arxiv.org/abs/2611.12542
  - Extends the numerical rejection to various five-hole and six-hole domains using a parallelized eigensolver (FEM/HPC). Reports parameter ranges (hole radius, separation, aspect ratio) over which closed interior nodal lines persist.

## Concept / Model

**Payne's nodal line conjecture**: for the second Neumann eigenfunction of the negative Laplacian on a bounded planar domain, the nodal line touches the domain boundary.

**Domain**: unit square [0,1]×[0,1] with N centered, non-overlapping circular holes (N ∈ {4, 5, 6}). Neumann boundary conditions on the outer boundary and on each hole boundary.

**Eigenproblem**: find the second smallest Neumann eigenvalue μ_1 (the first nonzero) and its eigenfunction u_1 of −Δ, with ∫ u_1 = 0 (orthogonal to constants). The nodal line is the zero set {x : u_1(x) = 0}.

**Metric**: `nodal_line_touches_boundary` (boolean) — does the zero set meet the outer boundary? And `min_distance_to_boundary` (length in domain units) — the minimum distance from any point on the nodal line to the outer boundary. A closed (interior) nodal line has `min_distance_to_boundary > 0`.

## Constants and Conventions

- Domain normalized to the unit square (side length 1); all lengths in domain units.
- Holes placed along the horizontal midline y = 0.5, equally spaced in x, centered in the square. For N holes the x-positions are x_i = (i+1)/(N+1), i = 0, …, N−1.
- Hole radius r must satisfy non-overlap: r < 1/(2(N+1)) (half the adjacent-hole spacing) and r < 0.5 (clearance to outer top/bottom boundaries).
- Neumann boundary conditions on outer boundary and hole boundaries.
- Mesh resolution reported per run; mesh-convergence check under refinement.

## Notes

- All computations are performed in software only (Python + NumPy/SciPy sparse eigensolver, P1 FEM on an unstructured triangular mesh generated via Delaunay triangulation).
- No physical measurement, hardware, or real-world data collection is involved.
- All results are labeled **simulated** (numerical PDE computation).
- No FEniCS/Dolfinx dependency; the eigensolver is scipy.sparse.linalg.eigsh (shift-invert, generalized problem K u = μ M u).