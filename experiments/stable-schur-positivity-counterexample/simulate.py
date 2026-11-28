#!/usr/bin/env python3
"""Stable Schur positivity counterexample (Borcea-Branden Problem 36).

Reproduction: python3 simulate.py

Exact integer/rational arithmetic. Verifies:
  (a) J1..J5 symmetric positive definite via leading principal minors > 0.
  (b) monomial expansion of q = (1/648) det(sum xi Ji) matches listed coefficients.
  (c) Kostka inversion yields Schur coefficients including [s_(1^5)]q = -2972.
  (d) closed-form identity [s_(1^5)]q = -2972.
Baseline: Kostka inversion on h_5 (Schur-positive) yields all Schur coeffs >= 0.

Result label: calculated (exact rational arithmetic; no physical measurement).
"""
from __future__ import annotations
import json
import os
import sys
from fractions import Fraction
from itertools import permutations

BASE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(BASE, "results")

# ---- matrices J1..J5 (from arXiv:2608.29595 Section 3.2, Theorem 3.7) ----
J1 = [
    [38,19,19,2,36],
    [19,38,2,19,36],
    [19,2,38,19,36],
    [2,19,19,38,36],
    [36,36,36,36,72],
]
J2 = [
    [38,19,19,17,21],
    [19,38,17,19,21],
    [19,17,38,34,36],
    [17,19,34,38,36],
    [21,21,36,36,42],
]
J3 = [
    [38,34,19,17,36],
    [34,38,17,19,36],
    [19,17,38,19,21],
    [17,19,19,38,21],
    [36,36,21,21,42],
]
J4 = [
    [38,4,19,2,21],
    [4,8,2,4,6],
    [19,2,38,4,21],
    [2,4,4,8,6],
    [21,6,21,6,42],
]
J5 = [
    [8,4,4,2,6],
    [4,38,2,19,21],
    [4,2,8,4,6],
    [2,19,4,38,21],
    [6,21,6,21,42],
]
JS = [J1, J2, J3, J4, J5]

# expected leading principal minors (from source)
EXPECTED_MINORS = {
    0: [38,1083,28728,202176,1119744],
    1: [38,1083,28728,202176,1119744],
    2: [38,288,8208,202176,1119744],
    3: [38,288,8208,46656,1119744],
    4: [8,288,1728,46656,1119744],
}

PARTITIONS = [(5,),(4,1),(3,2),(3,1,1),(2,2,1),(2,1,1,1),(1,1,1,1,1)]
# partition order used by paper
PORDER = [(5,),(4,1),(3,2),(3,1,1),(2,2,1),(2,1,1,1),(1,1,1,1,1)]

# Kostka matrix K (rows lambda Schur, cols mu monomial) in partition order
K = [
    [1,1,1,1,1,1,1],
    [0,1,1,2,2,3,4],
    [0,0,1,1,2,3,5],
    [0,0,0,1,1,3,6],
    [0,0,0,0,1,2,5],
    [0,0,0,0,0,1,4],
    [0,0,0,0,0,0,1],
]

EXPECTED_MONOMIAL = {
    (5,): 1728,
    (4,1): 19440,
    (3,2): 66555,
    (3,1,1): 140910,
    (2,2,1): 250440,
    (2,1,1,1): 547405,
    (1,1,1,1,1): 1182860,
}
EXPECTED_SCHUR = {
    (5,): 1728,
    (4,1): 17712,
    (3,2): 47115,
    (3,1,1): 56643,
    (2,2,1): 62415,
    (2,1,1,1): 56437,
    (1,1,1,1,1): -2972,
}


def leading_principal_minors(M):
    n = len(M)
    out = []
    for k in range(1, n+1):
        # determinant of top-left k x k
        sub = [row[:k] for row in M[:k]]
        out.append(det_int(sub))
    return out


def det_int(M):
    # exact integer determinant via expansion (small)
    n = len(M)
    if n == 0:
        return 1
    if n == 1:
        return M[0][0]
    if n == 2:
        return M[0][0]*M[1][1] - M[0][1]*M[1][0]
    # gaussian elimination over rationals for exactness
    A = [[Fraction(x) for x in row] for row in M]
    n = len(A)
    det = Fraction(1)
    for col in range(n):
        # find pivot
        piv = None
        for r in range(col, n):
            if A[r][col] != 0:
                piv = r; break
        if piv is None:
            return 0
        if piv != col:
            A[col], A[piv] = A[piv], A[col]
            det = -det
        inv = A[col][col]
        det *= inv
        for r in range(col+1, n):
            factor = A[r][col] / inv
            for c in range(col, n):
                A[r][c] -= factor * A[col][c]
    return int(det)


def parity(perm):
    # perm tuple
    inv = 0
    for i in range(len(perm)):
        for j in range(i+1, len(perm)):
            if perm[i] > perm[j]:
                inv += 1
    return -1 if (inv % 2) else 1


def det_expand_mon(Js):
    """Expand det(sum_i x_i J_i) into monomials; return dict partition->coeff (per monomial)."""
    # Js: list of 5 matrices
    total = {}  # counts tuple -> coeff
    for perm in permutations(range(5)):
        sign = parity(perm)
        # product over a of linear form L_a = sum_i x_i * Js[i][a][perm[a]]
        poly = {(0,0,0,0,0): 1}
        for a in range(5):
            coeffs = [Js[i][a][perm[a]] for i in range(5)]
            newpoly = {}
            for counts, c in poly.items():
                for i in range(5):
                    if coeffs[i] == 0:
                        continue
                    nc = list(counts); nc[i] += 1; nc = tuple(nc)
                    newpoly[nc] = newpoly.get(nc, 0) + c * coeffs[i]
            poly = newpoly
        for counts, c in poly.items():
            total[counts] = total.get(counts, 0) + sign * c
    # reduce to partitions: take sorted representative coefficient
    part_coeff = {}
    for counts, c in total.items():
        desc = sorted(counts, reverse=True)
        # strip trailing zeros so partitions of degree 5 with fewer parts compare correctly
        while len(desc) > 1 and desc[-1] == 0:
            desc.pop()
        key = tuple(desc)
        # verify consistency: store first; if present, assert equal
        if key in part_coeff:
            if part_coeff[key] != c:
                raise RuntimeError(f"Inconsistent coeff for {key}: {part_coeff[key]} vs {c}")
        else:
            part_coeff[key] = c
    return part_coeff, total


def invert_matrix_int(M):
    """Inverse of square matrix over rationals (Gauss-Jordan)."""
    n = len(M)
    A = [[Fraction(M[i][j]) for j in range(n)] + [Fraction(1) if i == j else Fraction(0) for j in range(n)] for i in range(n)]
    for col in range(n):
        piv = None
        for r in range(col, n):
            if A[r][col] != 0:
                piv = r; break
        if piv is None:
            raise ValueError("singular")
        A[col], A[piv] = A[piv], A[col]
        invp = A[col][col]
        A[col] = [x / invp for x in A[col]]
        for r in range(n):
            if r == col:
                continue
            factor = A[r][col]
            A[r] = [A[r][j] - factor * A[col][j] for j in range(2*n)]
    return [[A[i][n+j] for j in range(n)] for i in range(n)]


def ssyt_count(lam, mu):
    """Number of semistandard Young tableaux of shape lam, content mu (Kostka number).

    Content of a partition mu is the composition vector c where c[v] = number of
    parts of mu equal to v (sum c = |mu| = |lam|). Fillings: rows weakly
    increasing (left->right), columns strictly increasing (top->bottom).
    """
    lam = list(lam)
    content = [0] * 6
    for v_idx, mult in enumerate(mu, start=1):
        content[v_idx] = mult
    total = 0

    def fill(row, col, content_left, last_val, row_vals, prev_row_vals):
        nonlocal total
        if row == len(lam):
            if all(content_left[v] == 0 for v in range(1, 6)):
                total += 1
            return
        if col == lam[row]:
            # current row completed: its values become prev_row_vals next row
            fill(row + 1, 0, content_left, 1, [], list(row_vals))
            return
        for v in range(max(last_val, 1), 6):
            if content_left[v] == 0:
                continue
            if row > 0 and col < len(prev_row_vals) and v <= prev_row_vals[col]:
                continue
            cl2 = list(content_left)
            cl2[v] -= 1
            fill(row, col + 1, cl2, v, row_vals + [v], prev_row_vals)
        return

    fill(0, 0, content, 1, [], [])
    return total


def build_kostka_by_ssyt():
    """Build Kostka matrix K_{lambda,mu} by enumerating SSYT (independent derivation)."""
    parts = PORDER
    n = len(parts)
    K2 = [[0]*n for _ in range(n)]
    for li, lam in enumerate(parts):
        for mi, mu in enumerate(parts):
            K2[li][mi] = ssyt_count(lam, mu)
    return K2


def kostka_invert(c_vec, Kmat=None):
    if Kmat is None:
        Kmat = K
    # c = a K  => a = c K^{-1}; K given rows lambda cols mu. c is row vector of monomial coeffs.
    Kinv = invert_matrix_int(Kmat)
    # a_mu? a_lambda = sum_mu c_mu * (K^{-1})_{mu? } 
    # K_{lambda,mu}: c_mu? Let's define: monomial coeff vector c (indexed by mu, col). Schur coeff a (indexed by lambda, row).
    # c_mu = sum_lambda a_lambda K_{lambda,mu}. So c = a K (a row). Thus a = c K^{-1} (row): a_lambda = sum_mu c_mu * (K^{-1})_{mu, lambda}.
    # K^{-1} as matrix: (K^{-1})_{mu, lambda} = inverse[col=mu?]. Let's just compute: inv = K^{-1} (n x n). Then a_lambda = sum_mu c_mu * inv[mu][lambda] where inv indices [row=mu?].
    # Since inv = K^{-1}, K * inv = I. inv[mu][lambda] means row mu, col lambda. Need K_{row lambda?}. Let's be careful.
    # K is rows=lambda, cols=mu. inv = K^{-1} satisfies K @ inv = I (rows lambda, cols lambda). inv[mu_row? no].
    # We want: a (row lambda) = c (row mu) @ inv? c = a K => a = c K^{-1}. In matrix form a^T = (K^{-1})^T c^T. So a_lambda = sum_mu (K^{-1})^T[lambda][mu] c_mu = sum_mu K^{-1}[mu][lambda] c_mu.
    n = len(K)
    a = [Fraction(0)]*n
    for lam in range(n):
        s = Fraction(0)
        for mu in range(n):
            s += Fraction(c_vec[mu]) * Kinv[mu][lam]
        a[lam] = s
    return a


def main():
    os.makedirs(RESULTS, exist_ok=True)
    report = {}
    # ---- (a) leading principal minors ----
    minors_ok = True
    minors_detail = {}
    for idx, J in enumerate(JS):
        mins = leading_principal_minors(J)
        mins_exp = EXPECTED_MINORS[idx]
        minors_detail[f"J{idx+1}"] = mins
        if mins != mins_exp:
            minors_ok = False
        if any(m <= 0 for m in mins):
            minors_ok = False
    report["minors"] = minors_detail
    report["minors_match_expected"] = minors_ok

    # ---- (b) monomial expansion ----
    part_coeff, total_mon = det_expand_mon(JS)
    # q coeffs = part_coeff / 648
    monomial_q = {}
    for part in PORDER:
        c = part_coeff.get(part)
        monomial_q[part] = (Fraction(c, 648) if c is not None else Fraction(0))
    # compare to expected
    monomial_ok = True
    for part in PORDER:
        if monomial_q[part] != EXPECTED_MONOMIAL[part]:
            monomial_ok = False
    report["monomial_coefficients"] = {str(p): int(monomial_q[p]) for p in PORDER}
    report["monomial_match_expected"] = monomial_ok

    # ---- (c) Kostka inversion -> Schur coefficients ----
    c_vec = [EXPECTED_MONOMIAL[p] for p in PORDER]  # use computed? use monomial_q values
    c_vec = [int(monomial_q[p]) for p in PORDER]
    a_vec = kostka_invert(c_vec)
    schur_ok = True
    for i, part in enumerate(PORDER):
        if a_vec[i] != EXPECTED_SCHUR[part]:
            schur_ok = False
    report["schur_coefficients"] = {str(PORDER[i]): int(a_vec[i]) for i in range(len(PORDER))}
    report["schur_match_expected"] = schur_ok
    # independent verification of Kostka matrix via SSYT enumeration
    K2 = build_kostka_by_ssyt()
    kostka_independent_ok = (K2 == K)
    a_vec2 = kostka_invert(c_vec, K2)
    schur_independent_ok = (a_vec2 == a_vec)
    report["kostka_independent_match"] = kostka_independent_ok
    report["schur_independent_match"] = schur_independent_ok
    s_15 = a_vec[PORDER.index((1,1,1,1,1))]
    report["s_1_5"] = int(s_15)

    # ---- closed-form identity ----
    identity_val = (1728 - 2*19440 - 2*66555 + 3*140910 + 3*250440 - 4*547405 + 1182860)
    identity_ok = (identity_val == -2972)
    report["closed_form_identity"] = identity_val
    report["identity_ok"] = identity_ok

    # ---- baseline: h_5 Schur-positive ----
    # h_5 = sum over partitions m_mu (coeff 1 each). Schur: s_(5)=1, rest 0.
    h_mon = [1]*7
    h_schur = kostka_invert(h_mon)
    baseline_ok = (h_schur[0] == 1 and all(x == 0 for x in h_schur[1:]))
    report["baseline_h5_schur"] = [int(x) for x in h_schur]
    report["baseline_ok"] = baseline_ok

    # ---- verdict ----
    verdict = "supported"
    if not (minors_ok and monomial_ok and schur_ok and identity_ok and kostka_independent_ok and schur_independent_ok):
        verdict = "unsupported"
    report["verdict"] = verdict
    report["result_label"] = "calculated"

    # write raw output
    with open(os.path.join(RESULTS, "results.json"), "w") as f:
        json.dump(report, f, indent=2)
    # also write a human-readable coefficients file
    with open(os.path.join(RESULTS, "coefficients.txt"), "w") as f:
        f.write("Stable Schur Positivity Counterexample (Borcea-Branden Problem 36)\n")
        f.write("Result label: calculated (exact rational arithmetic)\n\n")
        f.write("Leading principal minors (J1..J5):\n")
        for i in range(5):
            f.write(f"  J{i+1}: {minors_detail[f'J{i+1}']}\n")
        f.write("\nMonomial coefficients of q:\n")
        for p in PORDER:
            f.write(f"  m_{p}: {monomial_q[p]}\n")
        f.write("\nSchur coefficients of q:\n")
        for i, p in enumerate(PORDER):
            f.write(f"  s_{p}: {a_vec[i]}\n")
        f.write(f"\n[s_(1^5)]q = {s_15}\n")
        f.write(f"Closed-form identity = {identity_val}\n")
        f.write(f"Verdict: {verdict.upper()}\n")

    # console summary
    print("Stable Schur Positivity Counterexample (Borcea-Branden Problem 36)")
    print(f"  minors all > 0 & match: {minors_ok}")
    print(f"  monomial expansion match: {monomial_ok}")
    print(f"  Kostka inversion match: {schur_ok}  ([s_(1^5)]q = {s_15})")
    print(f"  Kostka independent (SSYT) match: {kostka_independent_ok}; Schur independent match: {schur_independent_ok}")
    print(f"  closed-form identity: {identity_ok} ({identity_val})")
    print(f"  baseline (h_5 Schur-positive): {baseline_ok}")
    print(f"  Verdict: {verdict.upper()}")
    print(f"  Wrote {os.path.join(RESULTS,'results.json')} and coefficients.txt")
    return 0 if verdict == "supported" else 1


if __name__ == "__main__":
    sys.exit(main())
