# Payne Nodal Line Conjecture — Counterexample Check Report

**Experiment ID:** payne-nodal-line-counterexample  
**GitHub Issue:** #159  
**Date:** 2026-11-21  
**Status:** COMPLETED — Unsupported  
**Result label:** simulated (all results from numerical PDE computation; no physical measurement)

---

## Summary

This experiment tests the hypothesis that, for a unit square domain with N centered, non-overlapping circular holes (N ∈ {4, 5, 6}), the second Neumann eigenfunction's nodal line remains closed/interior (does not touch the outer boundary) over a non-trivial range of hole radii; finding at least one such parameter set would falsify Payne's nodal line conjecture (which predicts the nodal line always touches the boundary).

**Verdict: UNSUPPORTED.** All 9 tested parameter sets (N ∈ {4,5,6} × radius fractions {0.3, 0.6, 0.9} of the maximum non-overlapping radius) show `nodal_line_touches_boundary = true` and `min_distance_to_boundary = 0.0` at the converged (fine) mesh resolution. Every set is mesh-converged (relative change < 1%) and non-degenerate (relative eigenvalue gap > 1e-3). The hypothesis that a closed interior nodal line persists on this family is not supported; Payne's conjecture holds for every tested configuration.

---

## Method

### Domain and Boundary Conditions

- Domain: unit square [0,1] × [0,1] with N centered circular holes.
- Hole centers: (x_i, 0.5) with x_i = (i+1)/(N+1), i = 0,…,N−1 (symmetric, equally spaced along the midline y = 0.5).
- Hole radius: r = f · r_max(N), f ∈ {0.3, 0.6, 0.9}, r_max(N) = 0.45/(N+1) (90% of half the adjacent-hole spacing).
- Neumann boundary conditions on the outer boundary and on every hole boundary (∂u/∂n = 0).

### Finite-Element Discretization

- P1 (linear) finite elements on an unstructured triangular mesh.
- Mesh generation: regular Cartesian grid of (grid+1)² points over the square, with points inside holes removed; additional points sampled on each hole circle (40 per hole, scaled with grid). Delaunay triangulation (scipy.spatial.Delaunay); triangles whose centroid lies inside any hole are discarded. Mesh forced to counter-clockwise orientation.
- Stiffness matrix K and consistent mass matrix M assembled element-wise; Neumann conditions are natural (no boundary terms added).
- Two mesh resolutions per parameter set: coarse grid = 100, fine grid = 200. Mesh convergence requires relative change in `min_distance_to_boundary` < 1% (or both meshes touching → converged).

### Eigenproblem

Generalized eigenproblem K u = μ M u for the Neumann Laplacian (−Δ). The smallest eigenvalue μ_0 = 0 (constant mode); the second Neumann eigenvalue μ_1 and its eigenfunction are of interest.

Solved via scipy.sparse.linalg.eigsh with shift-invert (σ = 10⁻⁸, which = 'LM', k = min(4, n_nodes−2)) to obtain μ_0, μ_1, μ_2 reliably. Eigenfunction sign-normalized so u is positive near (0.25, 0.25). Degeneracy flagged if (μ_2 − μ_1)/μ_1 < 10⁻³.

Residual norm ||K u_1 − μ_1 M u_1|| / (|μ_1| · ||M u_1||) < 10⁻¹⁰ in all converged sets.

### Nodal Line Extraction

Zero contour of the P1 interpolant (matplotlib `tricontour` on the triangulation). For each contour segment, the minimum distance to the outer boundary is

    d = min( x, 1−x, y, 1−y )

over all contour points. `min_distance_to_boundary` = min d. `nodal_line_touches_boundary` = true if min_distance_to_boundary ≤ boundary_tol, where boundary_tol = max(2·h_char, 10⁻³) and h_char = √(2·⟨area⟩) is the characteristic mesh scale.

### Parameters

| Parameter | Values |
|-----------|--------|
| N (holes) | 4, 5, 6 |
| Radius fraction f | 0.3, 0.6, 0.9 |
| r_max(N) | 0.09000 (N=4), 0.07500 (N=5), 0.06429 (N=6) |
| Coarse grid | 100 |
| Fine grid | 200 |
| Master seed | 20261121 |

---

## Results

### Per-parameter-set outcomes (fine mesh)

| N | radius | μ_1 | μ_2 | rel gap | min_dist (coarse) | min_dist (fine) | touches (fine) | converged | degenerate | result |
|---|--------|-----|-----|---------|-------------------|-----------------|----------------|-----------|------------|--------|
| 4 | 0.02700 | 9.50563 | 9.72268 | 0.0228 | 0.0 | 0.0 | True | True | False | simulated |
| 4 | 0.05400 | 8.35776 | 9.38372 | 0.1228 | 0.0 | 0.0 | True | True | False | simulated |
| 4 | 0.08100 | 6.24490 | 9.06762 | 0.4520 | 0.0 | 0.0 | True | True | False | simulated |
| 5 | 0.02250 | 9.55211 | 9.75439 | 0.0212 | 0.0 | 0.0 | True | True | False | simulated |
| 5 | 0.04500 | 8.51151 | 9.49447 | 0.1155 | 0.0 | 0.0 | True | True | False | simulated |
| 5 | 0.06750 | 6.43609 | 9.27117 | 0.4405 | 0.0 | 0.0 | True | True | False | simulated |
| 6 | 0.01929 | 9.58902 | 9.77546 | 0.0194 | 0.0 | 0.0 | True | True | False | simulated |
| 6 | 0.03857 | 8.64206 | 9.56661 | 0.1070 | 0.0 | 0.0 | True | True | False | simulated |
| 6 | 0.05786 | 6.63049 | 9.40015 | 0.4177 | 0.0 | 0.0 | True | True | False | simulated |

All 9 sets: mesh-converged, non-degenerate, touching boundary, result label **simulated**.

### Verdict evaluation (from experiment.yaml)

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Closed interior found (supported) | nodal_line_touches_boundary = false AND min_distance > 0 for ≥ 1 set with N ≥ 4 | **FAIL** — 0/9 sets closed |
| All touching (unsupported) | nodal_line_touches_boundary = true for all tested sets | **PASS** — 9/9 sets touch |
| Inconclusive | degenerate or non-converged | 0 sets inconclusive |

Verdict: **unsupported**

---

## Discussion

### Symmetry mechanism

All tested configurations share a reflection symmetry about the midline y = 0.5 (holes centered on the midline). For this symmetric family, the second Neumann eigenfunction μ_1 belongs to the antisymmetric representation with respect to y ↔ 1−y. An antisymmetric function satisfies u(x, 0.5) = 0 along the entire midline (where the domain is present, i.e., between holes). This zero line connects to the outer boundary at the midpoints (0, 0.5) and (1, 0.5), forcing `nodal_line_touches_boundary = true` analytically — not as a numerical artifact.

Numerically: the midline nodes have |u| ≈ 10⁻⁷ (machine-precision zero), and the boundary-midpoint nodes have u ≈ 0, confirming the antisymmetric structure. The zero contour segments extracted by tricontour start/end exactly at these boundary points, yielding `min_distance_to_boundary = 0.0` exactly.

### Comparison to prior counterexamples

- **Dähne (numerical)**: a six-hole domain with a closed interior nodal line. The geometry was not constrained to the symmetric midline row; holes were positioned asymmetrically to break the reflection symmetry that forces a midline nodal line.
- **Mattfeldt & Kleefeld (2026), arXiv:2611.12542**: extended the numerical rejection to various five-hole and six-hole domains using HPC, exploring parameter ranges of hole radius, separation, and aspect ratio. Their domains also break the midline symmetry.

This experiment tested **only** the symmetric centered-row family. The result (unsupported) does not contradict the prior numerical counterexamples — it merely shows that **the symmetric family does not produce a closed interior nodal line**. The hypothesis that "a closed interior nodal line persists over a non-trivial range" is unsupported *for this family*; it remains an open question whether a closed line would appear if the symmetry were broken (e.g., by shifting holes off the midline, varying hole radii independently, or using non-circular holes).

### Limitations

- Tested domain family: N centered holes on a single symmetry axis. Other geometries (asymmetric, multiple rows, different shapes) were not explored.
- The midline symmetry forces μ_1 antisymmetric → nodal line touches boundary by construction. Breaking this symmetry is necessary to search for interior closed lines.
- Mesh resolution: fine grid = 200 (≈ 39k–41k nodes). Convergence confirmed; further refinement would not change the boolean outcome because the touching is an exact consequence of symmetry.

---

## Acceptance Checks (from experiment.yaml)

| Criterion | Result |
|-----------|--------|
| Reproduction command `python3 simulate.py` regenerates results/ | PASS |
| `results/` contains per-parameter output with eigenvalues, nodal_line_touches_boundary, min_distance_to_boundary | PASS (results/results.csv, results/nodal_lines/) |
| `report.md` labels each result as calculated or simulated | PASS (all results labeled **simulated**) |
| Verdict with quantitative basis | PASS (unsupported; 0/9 closed, 9/9 touching, all converged non-degenerate) |
| Smoke test passes | PASS |

---

## Reproduction

```bash
cd <repo root>
python3 experiments/payne-nodal-line-counterexample/simulate.py
```

Regenerates `results/results.csv`, `results/summary.json`, and `results/nodal_lines/` (default grid 100,200; full parameter grid N ∈ {4,5,6} × f ∈ {0.3,0.6,0.9}; ~15 s total).

CI / quick run:
```bash
python3 experiments/payne-nodal-line-counterexample/simulate.py --quick
python3 experiments/payne-nodal-line-counterexample/test_smoke.py
```

---

## Files Produced

| File | Description |
|------|-------------|
| `sources.md` | Source references (Dähne numerical; Mattfeldt & Kleefeld 2026, arXiv:2611.12542, DOI 10.48550/arXiv.2611.12542) |
| `experiment.yaml` | Signed hypothesis, baseline, metric, units, thresholds, stop condition |
| `simulate.py` | Reproducible FEM simulation (Python + NumPy/SciPy, P1 FEM, eigsh shift-invert) |
| `test_smoke.py` | Automated smoke test (7 checks) |
| `results/results.csv` | Raw per-set data (eigenvalues, nodal-line metrics, boolean, mesh convergence) |
| `results/summary.json` | Machine-readable summary with verdict |
| `results/nodal_lines/*.json` | Nodal-line contour coordinates (one file per set) |
| `report.md` | This report |

Result label: **simulated** (all results from numerical PDE computation; no physical measurement).

---

## Conclusion

The hypothesis that a closed interior nodal line (falsifying Payne's conjecture) persists over a non-trivial range of hole radii in the unit square with N centered, non-overlapping circular holes (N ∈ {4, 5, 6}) is **unsupported** by this experiment. All 9 tested parameter sets, at mesh-converged, non-degenerate resolution, produce a nodal line that touches the outer boundary (min_distance_to_boundary = 0.0). The touching is a direct consequence of the reflection symmetry of the tested family, which forces the second Neumann eigenfunction to be antisymmetric about the midline y = 0.5, yielding a nodal line along the midline that intersects the outer boundary at (0, 0.5) and (1, 0.5). This outcome is consistent with the prior numerical counterexamples (Dähne; Mattfeldt & Kleefeld) which used asymmetric hole configurations. Falsification of Payne's conjecture for this family would require breaking the midline symmetry; that exploration is outside the scope of this experiment.