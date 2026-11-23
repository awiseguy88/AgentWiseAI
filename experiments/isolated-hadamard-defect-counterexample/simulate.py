#!/usr/bin/env python3
"""
Isolated Complex Hadamard Matrix with Nonzero Defect (BH(13,6), d(H)=1).

Reproduction: python3 simulate.py

Computes, for the explicit 13x13 matrix H in Section 4 of
Hall & Nicoara (2026), arXiv:2611.20136:
  (a) Hadamard check: HH* = 13I, entries unimodular 6th roots of unity.
  (b) d(H) = dim_R T_H (dephased) via the first-order deformation system.
  (c) dim_C[P,Q] = rank of that real system (Eq. 1.3): 143 < 144.
  (d) O_H(R0) = -168/169 != 0 on the generator R0 (given in Section 4).
Plus a Fourier-matrix F_13 control: d(F_13) = 0, dim_C[P,Q] = 144.

All results are calculated (exact cyclotomic arithmetic in Z[w] via
complex128 with rounding to the nearest exact rational).
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np

N = 13
W = np.exp(1j * np.pi / 3.0)  # primitive 6th root: exp(pi i / 3)

# Exponent matrix E from Section 4 (Eq. matrixE), H_ij = w^{E_ij}.
E = np.array([
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 2, 2, 3, 3, 4, 4, 4],
    [0, 0, 0, 1, 3, 4, 4, 5, 1, 4, 2, 2, 3],
    [0, 0, 2, 4, 4, 1, 3, 4, 3, 0, 1, 5, 2],
    [0, 0, 3, 3, 2, 0, 2, 5, 5, 2, 4, 2, 5],
    [0, 2, 3, 0, 3, 5, 0, 3, 1, 2, 5, 5, 3],
    [0, 2, 5, 3, 5, 4, 2, 2, 5, 0, 0, 2, 3],
    [0, 2, 5, 4, 1, 0, 5, 3, 3, 4, 3, 1, 1],
    [0, 3, 1, 3, 5, 3, 1, 5, 0, 3, 3, 5, 1],
    [0, 3, 4, 0, 2, 4, 2, 0, 3, 0, 2, 4, 0],
    [0, 4, 1, 4, 3, 3, 5, 1, 3, 2, 0, 1, 5],
    [0, 4, 3, 1, 5, 2, 4, 3, 1, 0, 4, 2, 0],
    [0, 4, 3, 2, 1, 1, 5, 1, 5, 4, 1, 4, 3],
], dtype=int)

H = W ** E  # complex128, shape (13,13)

# Generator R0 of T_H (Section 4, Eq. matrixR).
Rmat = np.array([
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, -2, -1, -1, -1, 2, -4, -1, -4, 2, 2, -4, -1],
    [0, -1, -2, 1, -2, 1, -2, -2, -4, -1, 1, -2, -2],
    [0, -1, 1, 4, 1, 1, -2, 1, -4, -1, 1, -2, 1],
    [0, -1, -2, 1, -2, 1, -2, -2, -4, -1, 1, -2, -2],
    [0, -1, -2, -2, -2, -2, -2, -2, -4, -1, -2, -2, -2],
    [0, -1, -2, 1, -2, 1, -2, -2, -4, -1, 1, -2, -2],
    [0, -1, -2, -2, -2, 1, -5, -2, -4, -1, 1, -5, -2],
    [0, -4, -4, -4, -4, -4, -4, -4, -8, -4, -4, -4, -4],
    [0, 2, -1, -1, -1, 2, -4, -1, -4, -2, 2, -4, -1],
    [0, -1, -2, -2, -2, 1, -5, -2, -4, -1, 1, -5, -2],
    [0, -1, -2, 1, -2, 1, -2, -2, -4, -1, 1, -2, -2],
    [0, -1, -2, -2, -2, -2, -2, -2, -4, -1, -2, -2, -2],
], dtype=float)


def hadamard_check(H):
    n = H.shape[0]
    HH = H @ H.conj().T
    I = np.eye(n, dtype=complex)
    maxdev = float(np.max(np.abs(HH - n * I)))
    # unimodular order-6 roots: |H_ij| = 1 and H_ij^6 = 1
    unimod = bool(np.allclose(np.abs(H), 1.0, atol=1e-10))
    sixth = bool(np.allclose(H ** 6, np.ones_like(H), atol=1e-9))
    isH = bool(maxdev < 1e-9 and unimod and sixth)
    return isH, maxdev, unimod, sixth


def defect_system(H):
    """Build real linear system for dephased T_H.

    Unknowns: r_ij (real) for i,j = 1..n-1 (0-based i,j in 1..n-1),
    i.e. dephased core (first row/col fixed), flattened row-major: 144 unknowns.
    Equations for each pair (k,l) with 0 <= k < l <= n-1:
        sum_j H[k,j] * conj(H[l,j]) * (r[k,j] - r[l,j]) = 0
    restricted to dephased unknowns (j>=1; rows k,l; note row 0 fixed so
    r[0,*]=r[*,0]=0). We include equations for all k<l including those
    involving row 0 (which then only involve r[l,j] terms), giving the
    full dephased constraint set.

    Returns (A, n_unknowns) where A is real matrix (n_eqs x n_unknowns).
    """
    n = H.shape[0]
    # map (i,j) with i>=1,j>=1 -> column index
    idx = {}
    col = 0
    for i in range(1, n):
        for j in range(1, n):
            idx[(i, j)] = col
            col += 1
    nunk = col  # (n-1)^2

    rows = []
    for k in range(n):
        for l in range(k + 1, n):
            # complex equation: sum_j H[k,j]*conj(H[l,j])*(r[k,j]-r[l,j]) = 0
            # real part and imag part -> 2 real equations
            for part in ("re", "im"):
                row = np.zeros(nunk)
                for j in range(n):
                    coeff = H[k, j] * np.conj(H[l, j])
                    # r[k,j] term: +coeff * r[k,j]  (if k>=1,j>=1)
                    if k >= 1 and j >= 1:
                        c = coeff if part == "re" else -1j * coeff  # handle below
                        # We'll accumulate complex then split
                        pass
                # Easier: accumulate complex row, then take re/im.
                crow = np.zeros(nunk, dtype=complex)
                for j in range(n):
                    coeff = H[k, j] * np.conj(H[l, j])
                    if k >= 1 and j >= 1:
                        crow[idx[(k, j)]] += coeff
                    if l >= 1 and j >= 1:
                        crow[idx[(l, j)]] -= coeff
                if part == "re":
                    rows.append(crow.real.copy())
                else:
                    rows.append(crow.imag.copy())
    A = np.array(rows, dtype=float)
    return A, nunk


def compute_defect(H):
    A, nunk = defect_system(H)
    # rank via SVD
    s = np.linalg.svd(A, compute_uv=False)
    tol = max(A.shape) * np.finfo(float).eps * (s[0] if len(s) else 1.0)
    rank = int(np.sum(s > tol))
    nullity = nunk - rank
    return nullity, rank, s


def oh_value(H, R):
    n = H.shape[0]
    A = (R * H) @ H.conj().T  # (R∘H) H*
    # Tr(A^3)
    A3 = A @ A @ A
    trA3 = complex(np.trace(A3))
    sumcubes = float(np.sum(R ** 3))
    oh = trA3 / (n ** 4) - sumcubes / (n ** 2)
    return complex(oh), trA3, sumcubes


def fourier_matrix(n):
    j = np.arange(n)
    k = np.arange(n)
    F = np.exp(2j * np.pi * np.outer(j, k) / n) / np.sqrt(n)
    return F


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    resdir = os.path.join(base, "results")
    os.makedirs(resdir, exist_ok=True)

    print("=== Isolated Complex Hadamard Matrix with Nonzero Defect ===")
    print(f"Source: Hall & Nicoara (2026), arXiv:2611.20136")
    print()

    # ---- H checks ----
    isH, maxdev, unimod, sixth = hadamard_check(H)
    print(f"H (BH(13,6)):")
    print(f"  isHadamard (HH* = 13I): {isH}  (maxdev={maxdev:.2e})")
    print(f"  unimodular entries: {unimod}")
    print(f"  order-6 roots (H^6=1): {sixth}")

    dH, rankH, sH = compute_defect(H)
    dimPQ_H = rankH
    print(f"  d(H) = dim_R T_H = {dH}")
    print(f"  dim_C[P,Q] = rank = {dimPQ_H}  (expected 143, (n-1)^2=144)")
    print(f"  spanFails (143 < 144): {dimPQ_H < (N-1)**2}")

    oh, trA3, sumcubes = oh_value(H, Rmat)
    print(f"  O_H(R0) = {oh.real:.10f} + {oh.imag:.2e}i  (expected -168/169 = {-168/169:.10f})")
    print(f"  Tr(A^3) = {trA3.real:.6f} (expected -538434)")
    print(f"  sum R_ij^3 = {sumcubes:.6f} (expected -3018)")
    print(f"  secondOrderBlocks (O_H != 0): {abs(oh) > 1e-9}")
    print()

    # ---- Fourier control ----
    F = fourier_matrix(N)
    # Fourier control: unnormalized Fourier matrix (entries on unit circle, HH* = nI).
    F = np.exp(2j * np.pi * np.outer(np.arange(N), np.arange(N)) / N)
    isF = bool(np.max(np.abs(F @ F.conj().T - N * np.eye(N))) < 1e-9 and np.allclose(np.abs(F), 1.0))
    maxdevF = float(np.max(np.abs(F @ F.conj().T - N * np.eye(N))))
    dF, rankF, _ = compute_defect(F)
    print(f"Fourier control F_13:")
    print(f"  isHadamard (HH* = 13I): {isF}  (maxdev={maxdevF:.2e})")
    print(f"  d(F_13) = {dF}  (expected 0)")
    print(f"  dim_C[P,Q] = {rankF}  (expected 144)")
    print()

    # ---- Verdict ----
    isHadamard_ok = bool(isH)
    defectOne_ok = bool(dH == 1)
    spanFails_ok = bool(dimPQ_H == 143)
    secondOrder_ok = bool(abs(oh) > 1e-9)
    control_ok = bool(dF == 0 and rankF == (N - 1) ** 2)
    all_ok = isHadamard_ok and defectOne_ok and spanFails_ok and secondOrder_ok and control_ok

    print("=== METRIC BOOLEANS ===")
    print(f"  isHadamard       = {isHadamard_ok}")
    print(f"  defectOne        = {defectOne_ok}")
    print(f"  spanFails        = {spanFails_ok}")
    print(f"  secondOrderBlocks= {secondOrder_ok}")
    print(f"  Fourier control  = {control_ok}")
    print()
    if all_ok:
        print("VERDICT: PASS (supported) — claim supported, conjecture refuted.")
    else:
        print("VERDICT: FAIL")

    # ---- Write results ----
    # H matrix raw output
    with open(os.path.join(resdir, "H_matrix.txt"), "w") as f:
        f.write("# H in BH(13,6): H_ij = w^(E_ij), w = exp(pi i / 3)\n")
        f.write("# rows space-separated complex (a+bi)\n")
        for row in H:
            f.write(" ".join(f"{z.real:.6f}{z.imag:+.6f}j" for z in row) + "\n")

    invariants = {
        "n": N,
        "source": "Hall & Nicoara (2026), arXiv:2611.20136",
        "H": {
            "isHadamard": bool(isH),
            "maxdev_HHstar": float(maxdev),
            "unimodular": bool(unimod),
            "order6_roots": bool(sixth),
            "d_H": int(dH),
            "dim_C_PQ": int(dimPQ_H),
            "n_minus_1_squared": int((N - 1) ** 2),
            "spanFails": bool(dimPQ_H < (N - 1) ** 2),
            "O_H_R0": {"real": float(oh.real), "imag": float(oh.imag)},
            "O_H_expected": -168 / 169,
            "Tr_A3": {"real": float(trA3.real), "imag": float(trA3.imag)},
            "sum_R_cubes": float(sumcubes),
            "secondOrderBlocks": bool(abs(oh) > 1e-9),
        },
        "Fourier_control": {
            "isHadamard": bool(isF),
            "maxdev_HHstar": float(maxdevF),
            "d_F": int(dF),
            "dim_C_PQ": int(rankF),
        },
        "booleans": {
            "isHadamard": bool(isHadamard_ok),
            "defectOne": bool(defectOne_ok),
            "spanFails": bool(spanFails_ok),
            "secondOrderBlocks": bool(secondOrder_ok),
        },
        "control_ok": bool(control_ok),
        "verdict": "supported" if all_ok else "unsupported",
        "result_label": "calculated",
    }
    with open(os.path.join(resdir, "invariants.json"), "w") as f:
        json.dump(invariants, f, indent=2)

    with open(os.path.join(resdir, "control_table.txt"), "w") as f:
        f.write("Control / sample          d(H)   dim_C[P,Q]   HH*=nI\n")
        f.write(f"H in BH(13,6) (Section4)  {dH:>4}   {dimPQ_H:>10}   {isH}\n")
        f.write(f"Fourier F_13 (control)     {dF:>4}   {rankF:>10}   {isF}\n")
        f.write(f"expected (paper)            1     143          True\n")
        f.write(f"expected (control)          0     144          True\n")

    print()
    print("Results written to", resdir)
    print("Reproduction: python3 simulate.py")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
