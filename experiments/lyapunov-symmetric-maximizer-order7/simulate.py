#!/usr/bin/env python3
"""
Symmetric-Maximizer Conjecture Counterexample for Lyapunov Operators — Order 7.

Reproduction: python experiments/lyapunov-symmetric-maximizer-order7/simulate.py

Verifies Kressner & Vandereycken (2026), arXiv:2608.20875, Theorem 2:
    ||L_A|_S7||^2 < 1196 < ||L_A|_K7||^2
for L_A(X) = A X + X A^T (Frobenius-induced operator norm), with A the explicit
integer matrix of order 7 from Theorem 2 Eq. (4) and the skew-symmetric witness
K from the proof.

All linear algebra on A, K, ||K||_F^2 and ||L_A(K)||_F^2 is exact integer
arithmetic; the symmetric certificate M_S = 1196 D_S - B_S^T D_S B_S is
factored by exact rational LDL^T (fractions), giving pivots d_i. The float64
symmetric/skew restricted norms are computed as a control only.

PASS (conjecture false / claim supported):
    ||K||_F^2 == 53836 AND ||L_A(K)||_F^2 == 64387950 exactly (so skew > 1196)
    AND symmetric max eigenvalue < 1196 (numeric)
    AND exact certificate M_S ≻ 0 with all d_i >= 82  -> verdict: supported
"""

from __future__ import annotations

import json
import os
import sys
from fractions import Fraction
from math import gcd

import numpy as np

N = 7
SEPARATOR = 1196
MIN_PIVOT = 82


# ---------------------------------------------------------------------------
# Matrices from arXiv:2608.20875, Theorem 2 (Eq. 4) and its proof (matrix K).
# ---------------------------------------------------------------------------

A = np.array(
    [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [6, -5, -13, 0, 0, 0, 0],
        [-14, -18, 0, 0, 0, 0, 0],
        [12, -12, 11, 0, 0, 0, 0],
        [0, 0, 0, -6, 0, -14, 0],
        [0, 0, 0, 6, -18, 0, 0],
    ],
    dtype=np.int64,
)

K = np.array(
    [
        [0, 4, -9, 41, 71, 4, 6],
        [-4, 0, -11, -59, 105, -12, 3],
        [9, 11, 0, 59, -10, 36, -8],
        [-41, 59, -59, 0, 9, 0, 2],
        [-71, -105, 10, -9, 0, -15, 0],
        [-4, 12, -36, 0, 15, 0, 4],
        [-6, -3, 8, -2, 0, -4, 0],
    ],
    dtype=np.int64,
)


def frob_sq_int(M: np.ndarray) -> int:
    return int(np.sum(M.astype(object) ** 2))  # exact Python int


def lyap(A: np.ndarray, X: np.ndarray) -> np.ndarray:
    return A @ X + X @ A.T


# ---------------------------------------------------------------------------
# Coordinate matrices B_S and B_K for the Lyapunov operator restricted to
# the symmetric / skew-symmetric subspaces.
#
# Basis of S_7: E_11..E_77 (7), then E_ij + E_ji for i<j lexicographic (21).
# Gram: D_S = diag(I_7, 2 I_21).
# Basis of K_7: E_ij - E_ji for i<j lexicographic (21).
# Gram: D_K = 2 I_21.
#
# B_U columns = coordinates of L_A(basis_k) in the basis. Since L_A preserves
# each subspace, the coordinate of L_A(basis_k) w.r.t. basis element (p,q) is
# just the (p,q) entry of L_A(basis_k).
# ---------------------------------------------------------------------------

def build_bases(n: int):
    """Return (sym_basis_pairs, skew_basis_pairs) as lists of (i,j) 0-based."""
    sym_pairs = [(i, i) for i in range(n)]
    skew_pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            sym_pairs.append((i, j))
            skew_pairs.append((i, j))
    return sym_pairs, skew_pairs


def basis_matrix(n: int, i: int, j: int) -> np.ndarray:
    """E_ij + E_ji if i != j else E_ii (symmetric basis element)."""
    M = np.zeros((n, n), dtype=np.int64)
    if i == j:
        M[i, i] = 1
    else:
        M[i, j] = 1
        M[j, i] = 1
    return M


def skew_basis_matrix(n: int, i: int, j: int) -> np.ndarray:
    """E_ij - E_ji for i < j."""
    M = np.zeros((n, n), dtype=np.int64)
    M[i, j] = 1
    M[j, i] = -1
    return M


def coords_symmetric(L: np.ndarray, sym_pairs) -> list:
    """Coordinates of symmetric matrix L in the symmetric basis."""
    c = []
    for (i, j) in sym_pairs:
        c.append(int(L[i, j]))
    return c


def coords_skew(L: np.ndarray, skew_pairs) -> list:
    """Coordinates of skew-symmetric matrix L in the skew basis."""
    c = []
    for (i, j) in skew_pairs:
        c.append(int(L[i, j]))
    return c


def build_coordinate_matrices(n: int):
    sym_pairs, skew_pairs = build_bases(n)

    B_S = np.zeros((len(sym_pairs), len(sym_pairs)), dtype=np.int64)
    B_K = np.zeros((len(skew_pairs), len(skew_pairs)), dtype=np.int64)

    for k, (i, j) in enumerate(sym_pairs):
        b = basis_matrix(n, i, j)
        L = lyap(A, b)  # symmetric
        B_S[:, k] = coords_symmetric(L, sym_pairs)

    for k, (i, j) in enumerate(skew_pairs):
        b = skew_basis_matrix(n, i, j)
        L = lyap(A, b)  # skew-symmetric
        B_K[:, k] = coords_skew(L, skew_pairs)

    return B_S, B_K, sym_pairs, skew_pairs


def gram_symmetric(n: int) -> np.ndarray:
    """D_S = diag(I_7, 2 I_21)."""
    d = [1] * n + [2] * (n * (n - 1) // 2)
    return np.diag(np.array(d, dtype=np.int64))


def gram_skew(n: int) -> np.ndarray:
    """D_K = 2 I_{n(n-1)/2}."""
    m = n * (n - 1) // 2
    return 2 * np.eye(m, dtype=np.int64)


# ---------------------------------------------------------------------------
# Exact rational LDL^T factorization of a symmetric positive definite matrix
# over Fraction. Returns (L, D) with M = L diag(D) L^T, L unit lower triangular.
# ---------------------------------------------------------------------------

def ldl_transpose_exact(M):
    n = M.shape[0]
    L = [[Fraction(0) for _ in range(n)] for _ in range(n)]
    D = [Fraction(0) for _ in range(n)]
    for i in range(n):
        L[i][i] = Fraction(1)
    for j in range(n):
        s = Fraction(0)
        for k in range(j):
            s += L[j][k] * L[j][k] * D[k]
        D[j] = M[j][j] - s
        for i in range(j + 1, n):
            s = Fraction(0)
            for k in range(j):
                s += L[i][k] * L[j][k] * D[k]
            L[i][j] = (M[i][j] - s) / D[j]
    return L, D


def to_fraction_matrix(M: np.ndarray):
    return [[Fraction(int(M[i, j])) for j in range(M.shape[1])] for i in range(M.shape[0])]


def mat_mul_frac(Af, Bf):
    n = len(Af)
    m = len(Bf[0])
    p = len(Bf)
    C = [[Fraction(0) for _ in range(m)] for _ in range(n)]
    for i in range(n):
        for k in range(p):
            aik = Af[i][k]
            if aik == 0:
                continue
            for j in range(m):
                C[i][j] += aik * Bf[k][j]
    return C


def mat_transpose_frac(Af):
    return [[Af[i][j] for i in range(len(Af))] for j in range(len(Af[0]))]


def mat_add_frac(Af, Bf, scale_b=1):
    return [[Af[i][j] + scale_b * Bf[i][j] for j in range(len(Af[0]))] for i in range(len(Af))]


def scale_matrix_frac(Af, s):
    return [[s * x for x in row] for row in Af]


def is_positive_definite_ldl(Mf):
    """LDL^T over Fraction; return (ok, pivots D)."""
    n = Mf.shape[0] if hasattr(Mf, "shape") else len(Mf)
    L = [[Fraction(0) for _ in range(n)] for _ in range(n)]
    D = [Fraction(0) for _ in range(n)]
    for i in range(n):
        L[i][i] = Fraction(1)
    for j in range(n):
        s = Fraction(0)
        for k in range(j):
            s += L[j][k] * L[j][k] * D[k]
        D[j] = Mf[j][j] - s
        if D[j] <= 0:
            return False, D
        inv = Fraction(1) / D[j]
        for i in range(j + 1, n):
            s = Fraction(0)
            for k in range(j):
                s += L[i][k] * L[j][k] * D[k]
            L[i][j] = (Mf[i][j] - s) * inv
    return True, D


# ---------------------------------------------------------------------------
# Float64 controls: generalized eigenvalues B_U^T D_U B_U x = lambda D_U x.
# ---------------------------------------------------------------------------

def max_generalized_eigenvalue(B: np.ndarray, D: np.ndarray) -> float:
    """Largest generalized eigenvalue of (B^T D B, D) via scipy."""
    from scipy.linalg import eigh

    H = B.T @ D @ B
    # Symmetrize numerically (remove tiny asymmetry)
    H = (H + H.T) / 2.0
    Df = D.astype(np.float64)
    w = eigh(H, Df, eigvals_only=True)
    return float(w[-1])


# ---------------------------------------------------------------------------
# Random order-n<=5 control: check ||L_A|_K|| <= ||L_A|_S|| for random A.
# ---------------------------------------------------------------------------

def restricted_norms_float(n: int, seed: int = 0):
    """Return (sym_norm_sq, skew_norm_sq) for random integer A of order n."""
    rng = np.random.default_rng(seed)
    A_r = rng.integers(-9, 10, size=(n, n)).astype(np.int64)
    sym_pairs, skew_pairs = build_bases(n)

    def build_for(A_mat):
        B_S = np.zeros((len(sym_pairs), len(sym_pairs)), dtype=np.int64)
        B_K = np.zeros((len(skew_pairs), len(skew_pairs)), dtype=np.int64)
        for k, (i, j) in enumerate(sym_pairs):
            b = basis_matrix(n, i, j)
            L = A_mat @ b + b @ A_mat.T
            for c, (ii, jj) in enumerate(sym_pairs):
                B_S[c, k] = int(L[ii, jj])
        for k, (i, j) in enumerate(skew_pairs):
            b = skew_basis_matrix(n, i, j)
            L = A_mat @ b + b @ A_mat.T
            for c, (ii, jj) in enumerate(skew_pairs):
                B_K[c, k] = int(L[ii, jj])
        DS = gram_symmetric(n)
        DK = gram_skew(n)
        return B_S, B_K, DS, DK

    B_S, B_K, DS, DK = build_for(A_r)
    sym_lam = max_generalized_eigenvalue(B_S, DS)
    skew_lam = max_generalized_eigenvalue(B_K, DK)
    return sym_lam, skew_lam


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    results = {}

    results["matrix_order"] = N
    results["separator"] = SEPARATOR
    results["min_pivot_required"] = MIN_PIVOT

    # --- exact integer invariants for K ---
    k_frob_sq = frob_sq_int(K)
    LK = lyap(A, K)
    lk_frob_sq = frob_sq_int(LK)
    skew_ratio = Fraction(lk_frob_sq, k_frob_sq)

    results["K_frobenius_squared"] = k_frob_sq
    results["L_A_K_frobenius_squared"] = lk_frob_sq
    results["skew_ratio"] = {
        "numerator": lk_frob_sq,
        "denominator": k_frob_sq,
        "decimal": float(skew_ratio),
    }
    results["skew_exceeds_1196"] = skew_ratio > SEPARATOR

    # --- skew is exactly skew-symmetric ---
    results["K_is_skew_symmetric"] = bool(np.array_equal(K, -K.T))

    # --- build coordinate matrices ---
    B_S, B_K, sym_pairs, skew_pairs = build_coordinate_matrices(N)
    DS = gram_symmetric(N)
    DK = gram_skew(N)

    results["symmetric_subspace_dimension"] = len(sym_pairs)
    results["skew_subspace_dimension"] = len(skew_pairs)

    # --- exact certificate M_S = SEPARATOR * D_S - B_S^T D_S B_S ---
    H_S = B_S.T @ DS @ B_S  # integer matrix
    H_S = (H_S + H_S.T) // 2  # should already be symmetric; enforce
    M_S_int = SEPARATOR * DS - H_S
    M_S_frac = to_fraction_matrix(M_S_int)

    pd, pivots = is_positive_definite_ldl(M_S_frac)
    pivot_values = [float(p) for p in pivots]
    min_pivot = min(float(p) for p in pivots)
    all_pivots_ge_threshold = all(float(p) >= MIN_PIVOT for p in pivots)

    results["certificate_separator"] = SEPARATOR
    results["M_S_positive_definite"] = bool(pd)
    results["certificate_pivots"] = pivot_values
    results["certificate_min_pivot"] = min_pivot
    results["certificate_all_pivots_ge_82"] = bool(all_pivots_ge_threshold)
    results["certificate_num_pivots"] = len(pivots)

    # --- float64 controls ---
    sym_lam = max_generalized_eigenvalue(B_S, DS)
    skew_lam = max_generalized_eigenvalue(B_K, DK)

    results["symmetric_max_eigenvalue_float64"] = sym_lam
    results["skew_max_eigenvalue_float64"] = skew_lam
    results["symmetric_norm_less_than_1196_float64"] = sym_lam < SEPARATOR
    results["skew_norm_greater_than_1196_float64"] = skew_lam > SEPARATOR

    # --- n <= 5 controls (conjecture holds there) ---
    controls = []
    for n in (2, 3, 4, 5):
        for seed in range(3):
            sym_l, skew_l = restricted_norms_float(n, seed=1000 + n * 10 + seed)
            controls.append(
                {
                    "n": n,
                    "seed": seed,
                    "sym_norm_sq": sym_l,
                    "skew_norm_sq": skew_l,
                    "skew_le_sym": skew_l <= sym_l + 1e-9,
                }
            )
    results["controls_n_le_5"] = controls
    results["controls_all_skew_le_sym"] = all(c["skew_le_sym"] for c in controls)

    # --- verdict ---
    pass_conditions = [
        k_frob_sq == 53836,
        lk_frob_sq == 64387950,
        skew_ratio > SEPARATOR,
        sym_lam < SEPARATOR,
        bool(pd),
        all_pivots_ge_threshold,
    ]
    verdict = "supported" if all(pass_conditions) else ("unsupported" if not bool(pd) or sym_lam >= SEPARATOR else "inconclusive")

    results["pass_conditions"] = [bool(p) for p in pass_conditions]
    results["verdict"] = verdict
    results["result_label"] = "calculated"  # exact arithmetic, not a simulation

    print("=== Symmetric-Maximizer Conjecture Counterexample (order 7) ===")
    print(f"Source: Kressner & Vandereycken 2026, arXiv:2608.20875, Theorem 2")
    print()
    print(f"||K||_F^2                = {k_frob_sq}   (expected 53836)   {'OK' if k_frob_sq == 53836 else 'MISMATCH'}")
    print(f"||L_A(K)||_F^2           = {lk_frob_sq}   (expected 64387950)   {'OK' if lk_frob_sq == 64387950 else 'MISMATCH'}")
    print(f"ratio                    = {float(skew_ratio):.6f}   (> 1196: {skew_ratio > SEPARATOR})")
    print()
    print(f"symmetric max eigenvalue (float64) = {sym_lam:.6f}   (< 1196: {sym_lam < SEPARATOR})")
    print(f"skew max eigenvalue    (float64) = {skew_lam:.6f}   (> 1196: {skew_lam > SEPARATOR})")
    print()
    print(f"M_S = 1196 D_S - B_S^T D_S B_S positive definite: {pd}")
    print(f"number of LDL^T pivots: {len(pivots)}")
    print(f"min pivot d_i: {min_pivot:.6f}   (all >= 82: {all_pivots_ge_threshold})")
    print()
    print(f"n<=5 controls (skew <= sym): {results['controls_all_skew_le_sym']}")
    print()
    print(f"VERDICT: {verdict.upper()}  (result label: {results['result_label']})")
    print()

    # --- write results ---
    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base, "results")
    os.makedirs(results_dir, exist_ok=True)

    out_path = os.path.join(results_dir, "output.json")
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Wrote raw results to {out_path}")

    # Also write a human-readable invariants file.
    inv_path = os.path.join(results_dir, "invariants.txt")
    with open(inv_path, "w") as f:
        f.write("Invariants (exact unless marked float64)\n")
        f.write("=" * 50 + "\n")
        f.write(f"||K||_F^2 = {k_frob_sq}\n")
        f.write(f"||L_A(K)||_F^2 = {lk_frob_sq}\n")
        f.write(f"ratio = {lk_frob_sq}/{k_frob_sq} = {float(skew_ratio):.9f}\n")
        f.write(f"ratio > 1196: {skew_ratio > SEPARATOR}\n")
        f.write(f"symmetric max eigenvalue (float64) = {sym_lam:.9f}\n")
        f.write(f"skew max eigenvalue (float64) = {skew_lam:.9f}\n")
        f.write(f"M_S positive definite: {pd}\n")
        f.write(f"pivots d_i: " + ", ".join(f"{v:.9f}" for v in pivot_values) + "\n")
        f.write(f"min pivot = {min_pivot:.9f}; all >= 82: {all_pivots_ge_threshold}\n")
        f.write(f"verdict = {verdict}\n")
    print(f"Wrote invariants to {inv_path}")

    return 0 if verdict == "supported" else 1


if __name__ == "__main__":
    sys.exit(main())
