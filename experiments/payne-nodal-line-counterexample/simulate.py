#!/usr/bin/env python3
"""
Payne Nodal Line Conjecture Counterexample — numerical experiment.

Computes the second Neumann eigenfunction of -Delta on the unit square [0,1]^2
with N centered, non-overlapping circular holes (Neumann boundary conditions
on the outer boundary and on every hole boundary), extracts the nodal line
(zero contour of the eigenfunction), and measures whether it touches the outer
boundary and its minimum distance to the outer boundary.

Domain convention
-----------------
- Unit square [0,1] x [0,1] (side length 1; all lengths in domain units).
- N holes with centers on the midline y = 0.5 at x_i = (i+1)/(N+1),
  i = 0, ..., N-1 (symmetric, centered arrangement).
- Hole radius r must satisfy r < 1/(2(N+1)) (non-overlap) and r < 0.5.
- Max radius used: r_max(N) = 0.9 / (2(N+1)).

Method
------
P1 finite elements on a Delaunay triangulation of the domain (regular grid
points outside the holes plus boundary points sampled on each hole circle).
Neumann conditions are natural: no boundary terms are added. The generalized
eigenproblem K u = mu M u is solved with scipy.sparse.linalg.eigsh
(shift-invert, smallest eigenvalues); mu_0 = 0 (constant mode), mu_1 is the
second Neumann eigenvalue and its eigenfunction is the one of interest.
The eigenfunction is sign-normalized deterministically. The nodal line is the
zero contour (matplotlib tricontour on the P1 interpolant).

All results are simulated (numerical computation; no physical measurement).

Reproduction: python3 experiments/payne-nodal-line-counterexample/simulate.py
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
import time

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse import linalg as spla
from scipy.spatial import Delaunay

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.tri as mtri
    HAS_MATPLOTLIB = True
except Exception:  # pragma: no cover - matplotlib only needed for contours
    HAS_MATPLOTLIB = False


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def hole_positions(N: int):
    """Centers of N holes on the midline y = 0.5, centered in the square."""
    cx = [(i + 1) / (N + 1) for i in range(N)]
    cy = [0.5] * N
    return cx, cy


def max_radius(N: int) -> float:
    """Largest radius keeping holes non-overlapping and clear of the boundary."""
    return 0.9 * 0.5 / (N + 1)  # 0.9 * half the adjacent-hole spacing


def inside_holes(x, y, cx, cy, r):
    """Boolean mask: True for points strictly inside any hole."""
    inside = np.zeros_like(x, dtype=bool)
    for i in range(len(cx)):
        inside |= (x - cx[i]) ** 2 + (y - cy[i]) ** 2 < r * r
    return inside


def circle_boundary_points(cx, cy, r, n_per_hole: int = 40):
    """Points on each hole circle (resolves hole boundary in the mesh)."""
    xs, ys = [], []
    for i in range(len(cx)):
        t = np.linspace(0.0, 2.0 * np.pi, n_per_hole, endpoint=False)
        xs.append(cx[i] + r * np.cos(t))
        ys.append(cy[i] + r * np.sin(t))
    return np.concatenate(xs), np.concatenate(ys)


def build_mesh(N: int, r: float, grid: int):
    """Delaunay P1 mesh of the unit square with N holes.

    Returns (pts, tris) where pts is (n, 2) and tris is (nt, 3) with
    counter-clockwise orientation. Only triangles whose centroid lies outside
    all holes are kept.
    """
    cx, cy = hole_positions(N)
    h = 1.0 / grid
    # Regular grid over the closed square.
    gs = np.linspace(0.0, 1.0, grid + 1)
    X, Y = np.meshgrid(gs, gs)
    X = X.ravel(); Y = Y.ravel()
    keep = ~inside_holes(X, Y, cx, cy, r)
    xs = [X[keep]]; ys = [Y[keep]]
    # Hole boundary points (on the circles, so they are kept).
    bx, by = circle_boundary_points(cx, cy, r, n_per_hole=max(24, 8 * grid // 10))
    xs.append(bx); ys.append(by)
    pts = np.column_stack([np.concatenate(xs), np.concatenate(ys)])

    tri = Delaunay(pts)
    tris = tri.simplices.copy()
    # Force counter-clockwise orientation (positive signed area).
    p0 = pts[tris[:, 0]]; p1 = pts[tris[:, 1]]; p2 = pts[tris[:, 2]]
    detJ = (p1[:, 0] - p0[:, 0]) * (p2[:, 1] - p0[:, 1]) - \
           (p2[:, 0] - p0[:, 0]) * (p1[:, 1] - p0[:, 1])
    flip = detJ < 0
    if np.any(flip):
        tris[flip, 1] = tris[flip, 1]
        tris[flip, [1, 2]] = tris[flip, [2, 1]]
        detJ[flip] = -detJ[flip]

    # Keep triangles whose centroid is outside every hole.
    cen = pts[tris].mean(axis=1)
    out = ~inside_holes(cen[:, 0], cen[:, 1], cx, cy, r)
    tris = tris[out]

    # Keep only referenced nodes, reindex compactly.
    used = np.unique(tris.ravel())
    index = np.full(len(pts), -1, dtype=np.int64)
    index[used] = np.arange(len(used))
    pts = pts[used]
    tris = index[tris]
    return pts, tris


def assemble(pts, tris):
    """P1 stiffness K and consistent mass M for -Delta (Neumann: natural)."""
    n = len(pts)
    x = pts[:, 0]; y = pts[:, 1]
    x0 = x[tris[:, 0]]; y0 = y[tris[:, 0]]
    x1 = x[tris[:, 1]]; y1 = y[tris[:, 1]]
    x2 = x[tris[:, 2]]; y2 = y[tris[:, 2]]
    detJ = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)  # > 0 (CCW)
    area = 0.5 * detJ
    # Gradients of the linear basis functions: grad phi_i = (b_i, c_i) / detJ.
    b = np.stack([y1 - y2, y2 - y0, y0 - y1], axis=1) / detJ[:, None]
    c = np.stack([x2 - x1, x0 - x2, x1 - x0], axis=1) / detJ[:, None]
    Ke = area[:, None, None] * (
        b[:, :, None] * b[:, None, :] + c[:, :, None] * c[:, None, :]
    )  # (nt, 3, 3)
    Me = (area / 12.0)[:, None, None] * np.array(
        [[2.0, 1.0, 1.0], [1.0, 2.0, 1.0], [1.0, 1.0, 2.0]]
    )[None]  # (nt, 3, 3)
    rows = np.repeat(tris, 3, axis=1)
    cols = np.tile(tris, (1, 3))
    K = coo_matrix((Ke.ravel(), (rows.ravel(), cols.ravel())), shape=(n, n)).tocsr()
    M = coo_matrix((Me.ravel(), (rows.ravel(), cols.ravel())), shape=(n, n)).tocsr()
    K.sum_duplicates()
    M.sum_duplicates()
    return K, M, area


def second_neumann_eigenpair(K, M, n_nodes: int):
    """Smallest nonzero Neumann eigenpair of K u = mu M u via shift-invert.

    Returns (mu_1, u_1, mu_2, rel_gap, residual).
    """
    k = min(4, n_nodes - 2)
    if k < 2:
        raise RuntimeError("Mesh too small for eigen solve.")
    sigma = 1e-8
    w, V = spla.eigsh(
        K, k=k, M=M, sigma=sigma, which="LM",
        tol=1e-10, maxiter=2000, return_eigenvectors=True,
    )
    order = np.argsort(np.asarray(w, dtype=float))
    mu = np.asarray(w, dtype=float)[order]
    U = np.asarray(V)[:, order]
    mu1 = float(mu[1])
    u1 = np.asarray(U[:, 1], dtype=float)
    mu2 = float(mu[2]) if k >= 3 else None
    rel_gap = (mu2 - mu1) / mu1 if (mu2 is not None and mu1 > 0) else None

    # Residual of the eigenpair.
    residual = None
    if n_nodes > 0:
        r_vec = K.dot(u1) - mu1 * M.dot(u1)
        norm_Mu = np.linalg.norm(M.dot(u1))
        residual = float(np.linalg.norm(r_vec) / max(abs(mu1) * norm_Mu, 1e-300))
    return mu1, u1, mu2, rel_gap, residual


def normalize_sign(u1: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Flip sign so the value at (0.25, 0.25) is >= 0 (deterministic)."""
    j = int(np.argmin((pts[:, 0] - 0.25) ** 2 + (pts[:, 1] - 0.25) ** 2))
    if u1[j] < 0:
        u1 = -u1
    return u1


# ---------------------------------------------------------------------------
# Nodal line extraction
# ---------------------------------------------------------------------------

def nodal_line_metrics(pts, tris, u1, boundary_tol):
    """Extract zero contour; compute min distance to outer boundary.

    Returns (segments, min_distance, touches_boundary, n_segments, n_points).
    segments: list of (m, 2) float arrays (contour vertices, domain units).
    """
    if not HAS_MATPLOTLIB:
        raise RuntimeError("matplotlib is required for nodal-line extraction")
    triang = mtri.Triangulation(pts[:, 0], pts[:, 1], triangles=tris)
    # Use tricontour via matplotlib's contour API on the triangulation.
    import matplotlib.pyplot as plt
    fig = plt.figure()
    ax = fig.add_subplot(111)
    tcf = ax.tricontour(triang, u1, levels=[0.0])
    plt.close(fig)
    segs = tcf.allsegs[0] if tcf.allsegs and len(tcf.allsegs) > 0 else []
    segments = [np.asarray(s, dtype=float) for s in segs if s is not None and len(s) >= 2]
    if segments:
        pts_all = np.vstack(segments)
        d = np.minimum.reduce([
            pts_all[:, 0], 1.0 - pts_all[:, 0],
            pts_all[:, 1], 1.0 - pts_all[:, 1],
        ])
        min_distance = float(d.min())
    else:
        min_distance = float("inf")
    touches = bool(segments) and min_distance <= boundary_tol
    return segments, min_distance, bool(touches), len(segments), \
        int(sum(s.shape[0] for s in segments))


# ---------------------------------------------------------------------------
# Per parameter set
# ---------------------------------------------------------------------------

def run_parameter_set(N: int, r: float, grids, seed: int):
    """Run one (N, r) parameter set at coarse and fine mesh resolution.

    Returns a dict with eigenvalues, nodal-line metrics, convergence info.
    """
    cx, cy = hole_positions(N)
    results = {"N": N, "radius": r,
               "hole_positions": [{"x": float(cx[i]), "y": float(cy[i])}
                                  for i in range(N)]}
    coarse = solve_at_grid(N, r, grids[0], cx, cy, seed, label="coarse")
    fine = solve_at_grid(N, r, grids[1], cx, cy, seed, label="fine")

    for key, res in (("coarse", coarse), ("fine", fine)):
        results[key] = {k: v for k, v in res.items()
                        if k not in ("segments",)}
        # keep nodal-line geometry compactly for the fine mesh
    results["fine"] = {**fine, "segments": fine["segments"]}

    # Mesh convergence on min_distance_to_boundary.
    d_c = coarse["min_distance_to_boundary"]
    d_f = fine["min_distance_to_boundary"]
    touch_c = coarse["nodal_line_touches_boundary"]
    touch_f = fine["nodal_line_touches_boundary"]
    if touch_c and touch_f:
        rel_change = 0.0
        converged = True
    elif d_c == float("inf") or d_f == float("inf"):
        rel_change = float("nan")
        converged = False
    else:
        scale = max(abs(d_c), 1e-12)
        rel_change = abs(d_f - d_c) / scale
        converged = bool(rel_change < 0.01)

    # A set counts as confirmed closed only if converged, not degenerate, and
    # closed at the fine (converged) mesh.
    degenerate = bool(coarse["degenerate"]) or bool(fine["degenerate"])
    closed = (not touch_f) and converged and (d_f > 0.0) and not degenerate
    touching = touch_f and converged and not degenerate

    results.update({
        "mu_1": fine["mu_1"],
        "mu_2": fine["mu_2"],
        "rel_gap": fine["rel_gap"],
        "degenerate": degenerate,
        "residual": fine["residual"],
        "n_nodes_coarse": coarse["n_nodes"],
        "n_elements_coarse": coarse["n_elements"],
        "n_nodes_fine": fine["n_nodes"],
        "n_elements_fine": fine["n_elements"],
        "min_distance_to_boundary_coarse": d_c,
        "min_distance_to_boundary_fine": d_f,
        "relative_change": float(rel_change),
        "mesh_converged": bool(converged),
        "boundary_tol_coarse": coarse["boundary_tol"],
        "boundary_tol_fine": fine["boundary_tol"],
        "nodal_line_touches_boundary_coarse": bool(touch_c),
        "nodal_line_touches_boundary_fine": bool(touch_f),
        "nodal_line_touches_boundary": bool(touch_f),
        "closed_interior": bool(closed),
        "touching_boundary": bool(touching),
        "inconclusive_set": bool(degenerate or not converged),
        "result_label": "simulated",
    })
    return results


def solve_at_grid(N, r, grid, cx, cy, seed, label):
    pts, tris = build_mesh(N, r, grid)
    n_nodes = len(pts); n_elements = len(tris)
    K, M, area = assemble(pts, tris)
    mu1, u1, mu2, rel_gap, residual = second_neumann_eigenpair(K, M, n_nodes)
    u1 = normalize_sign(u1, pts)
    degenerate = bool(rel_gap is not None and rel_gap < 1e-3)
    h_char = float(np.sqrt(2.0 * area.mean()))
    boundary_tol = max(2.0 * h_char, 1e-3)
    segments, min_distance, touches, n_seg, n_pts = nodal_line_metrics(
        pts, tris, u1, boundary_tol)
    return {
        "label": label, "grid": grid,
        "mu_1": float(mu1), "mu_2": (float(mu2) if mu2 is not None else None),
        "rel_gap": (float(rel_gap) if rel_gap is not None else None),
        "degenerate": degenerate,
        "residual": residual,
        "n_nodes": n_nodes, "n_elements": n_elements,
        "boundary_tol": float(boundary_tol),
        "min_distance_to_boundary": float(min_distance),
        "nodal_line_touches_boundary": bool(touches),
        "n_segments": n_seg, "n_contour_points": n_pts,
        "segments": segments,
    }


# ---------------------------------------------------------------------------
# Sweep / verdict
# ---------------------------------------------------------------------------

def verdict_from(sets):
    closed = [s for s in sets if s["closed_interior"]]
    touching = [s for s in sets if s["touching_boundary"]]
    inconclusive = [s for s in sets if s["inconclusive_set"]]
    if closed:
        return "supported"
    if touching and not inconclusive:
        return "unsupported"
    return "inconclusive"


def main():
    ap = argparse.ArgumentParser(
        description="Payne nodal line counterexample experiment.")
    ap.add_argument("--N-list", type=str, default="4,5,6",
                    help="comma-separated hole counts")
    ap.add_argument("--radius-fractions", type=str, default="0.3,0.6,0.9",
                    help="comma-separated fractions of max_radius(N)")
    ap.add_argument("--grids", type=str, default="100,200",
                    help="comma-separated coarse,fine grid points per side")
    ap.add_argument("--seed", type=int, default=20261121,
                    help="master seed (deterministic mesh; recorded)")
    ap.add_argument("--quick", action="store_true",
                    help="quick CI/smoke run: N=4, radius 0.6*rmax, grid 100")
    ap.add_argument("--output", type=str, default=None,
                    help="results directory (default: results/ next to this file)")
    args = ap.parse_args()

    if args.quick:
        N_list = [4]
        radius_fractions = [0.6]
        grids = [100, 100]
    else:
        N_list = [int(x) for x in args.N_list.split(",")]
        radius_fractions = [float(x) for x in args.radius_fractions.split(",")]
        grids = [int(x) for x in args.grids.split(",")]
    if len(grids) != 2:
        print("FAIL: --grids must be coarse,fine", file=sys.stderr)
        return 2

    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = args.output or os.path.join(base, "results")
    lines_dir = os.path.join(results_dir, "nodal_lines")
    os.makedirs(results_dir, exist_ok=True)
    os.makedirs(lines_dir, exist_ok=True)

    all_sets = []
    early_stop = False
    for N in N_list:
        if early_stop:
            break
        rmax = max_radius(N)
        for frac in radius_fractions:
            if early_stop:
                break
            r = rmax * frac
            if r <= 0 or r >= 0.5:
                print(f"SKIP N={N} r={r:.5f}: invalid radius", flush=True)
                continue
            t0 = time.time()
            try:
                s = run_parameter_set(N, r, grids, args.seed)
            except Exception as exc:  # pragma: no cover - report failures cleanly
                print(f"FAIL N={N} r={r:.5f}: {exc}", file=sys.stderr, flush=True)
                s = {"N": N, "radius": r, "error": str(exc),
                     "result_label": "simulated", "inconclusive_set": True,
                     "closed_interior": False, "touching_boundary": False}
            s["runtime_s"] = time.time() - t0
            all_sets.append(s)
            status = ("closed" if s.get("closed_interior") else
                      ("touching" if s.get("touching_boundary") else "inconclusive"))
            print(f"N={N} r={r:.5f} (r/rmax={frac}): mu_1={s.get('mu_1'):.6f}"
                  f" min_dist={s.get('min_distance_to_boundary_fine', 'NA')}"
                  f" touches={s.get('nodal_line_touches_boundary_fine')}"
                  f" converged={s.get('mesh_converged')} degenerate={s.get('degenerate')}"
                  f" -> {status} ({s['runtime_s']:.1f}s)", flush=True)
            # Stop condition: confirmed closed interior nodal line for one set.
            if s.get("closed_interior") and s.get("mesh_converged"):
                early_stop = True
                print("STOP: closed interior nodal line confirmed for a parameter set.",
                      flush=True)

            # Write raw nodal-line geometry for the fine mesh; remove ndarrays.
            fine_segs = s.get("fine", {}).pop("segments", None)
            s.get("coarse", {}).pop("segments", None)
            if fine_segs is not None:
                safe = f"N{N}_r{r:.6f}".replace(".", "p")
                with open(os.path.join(lines_dir, f"{safe}.json"), "w") as f:
                    json.dump({
                        "N": N, "radius": r, "segments": [
                            seg.tolist() for seg in fine_segs
                        ],
                    }, f)
                s["nodal_line_file"] = f"nodal_lines/{safe}.json"
            else:
                s["nodal_line_file"] = None

    verdict = verdict_from(all_sets)

    summary = {
        "experiment": "payne-nodal-line-counterexample",
        "issue": 159,
        "hypothesis": ("For N in {4,5,6} centered holes the nodal line remains "
                       "closed/interior over a non-trivial radius range; at least "
                       "one closed set falsifies Payne's conjecture."),
        "baseline": "Payne's conjecture: nodal_line_touches_boundary = true always.",
        "domain": "unit square [0,1] x [0,1], N centered holes on midline y=0.5",
        "boundary_conditions": "Neumann on outer boundary and hole boundaries",
        "N_list": N_list,
        "radius_fractions": radius_fractions,
        "grids": grids,
        "seed": args.seed,
        "max_radius": {N: max_radius(N) for N in N_list},
        "thresholds": {
            "pass": "nodal_line_touches_boundary = false AND min_distance_to_boundary > 0 "
                    "for at least one tested parameter set with N >= 4",
            "fail": "nodal_line_touches_boundary = true for every tested parameter set",
            "inconclusive": "degenerate second eigenvalue or mesh-convergence failure",
        },
        "result_label": "simulated",
        "verdict": verdict,
        "n_sets": len(all_sets),
        "n_closed": sum(1 for s in all_sets if s.get("closed_interior")),
        "n_touching": sum(1 for s in all_sets if s.get("touching_boundary")),
        "n_inconclusive": sum(1 for s in all_sets if s.get("inconclusive_set")),
        "early_stop": bool(early_stop),
        "sets": all_sets,
        "runtime_s": sum(s.get("runtime_s", 0.0) for s in all_sets),
    }

    # results.csv
    csv_path = os.path.join(results_dir, "results.csv")
    fieldnames = ["N", "radius", "mu_1", "mu_2", "rel_gap", "degenerate",
                  "residual", "n_nodes_coarse", "n_elements_coarse",
                  "n_nodes_fine", "n_elements_fine",
                  "min_distance_to_boundary_coarse",
                  "min_distance_to_boundary_fine",
                  "relative_change", "mesh_converged",
                  "boundary_tol_coarse", "boundary_tol_fine",
                  "nodal_line_touches_boundary_coarse",
                  "nodal_line_touches_boundary_fine",
                  "nodal_line_touches_boundary",
                  "closed_interior", "touching_boundary",
                  "inconclusive_set", "n_segments", "n_contour_points",
                  "result_label", "runtime_s", "nodal_line_file",
                  "hole_positions"]
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for s in all_sets:
            row = {k: s.get(k) for k in fieldnames}
            row["hole_positions"] = json.dumps(s.get("hole_positions", []))
            w.writerow(row)

    def _json_default(o):
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.bool_,)):
            return bool(o)
        if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
            return None
        raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

    summary_path = os.path.join(results_dir, "summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2, default=_json_default)

    print(f"\nVerdict: {verdict.upper()}")
    print(f"Closed interior sets: {summary['n_closed']} / {summary['n_sets']}")
    print(f"Touching sets: {summary['n_touching']} / {summary['n_sets']}")
    print(f"Inconclusive sets: {summary['n_inconclusive']} / {summary['n_sets']}")
    print(f"Wrote {csv_path} and {summary_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
