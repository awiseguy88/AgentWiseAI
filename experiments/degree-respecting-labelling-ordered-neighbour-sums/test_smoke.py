#!/usr/bin/env python3
"""Smoke test for the degree-respecting labelling experiment (Ishikawa–Uda 2026).

Reproduction: python experiments/degree-respecting-labelling-ordered-neighbour-sums/test_smoke.py
All checks are exact (integer / Fraction) and fast.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import run as R  # noqa: E402


def test_example4_anchor():
    """Example 4 (2-methylbutane): exactly two valid labellings, degree-1 {2,3,4}/{1,1,2}."""
    cat = {g[0]: g for g in R.graph_catalogue()}
    _, n, edges, _ = cat["example4_2methylbutane"]
    c = R.weight_power2
    res = R.verify(n, edges, c)
    assert res["degrees"] == [3, 2, 1, 1, 1], res["degrees"]
    assert res["num_valid"] == 2, res["num_valid"]
    assert res["violations_1_1"] == 0 and res["violations_1_3"] == 0, res
    f = res["f_star"]
    deg1_labels = sorted(f[i] for i in range(n) if res["degrees"][i] == 1)
    deg1_sums = sorted(res["neighbour_sums_f_star"][i]
                       for i in range(n) if res["degrees"][i] == 1)
    assert deg1_labels == [2, 3, 4], deg1_labels
    assert deg1_sums == ["1", "1", "2"], deg1_sums


def test_phi_minimizer_is_minimal():
    """f* attains the brute-force minimum of Phi over degree-respecting labellings."""
    cat = {g[0]: g for g in R.graph_catalogue()}
    for name in ["example4_2methylbutane", "paw", "C_5", "double_star", "K2_3"]:
        _, n, edges, _ = cat[name]
        for wname in ["2^i", "i", "nonlinear"]:
            c = R.WEIGHT_FUNCS[wname]
            A = R.degree_respecting_labellings(n, edges, c)
            phis = [R.edge_potential(n, edges, f, c) for f in A]
            f_star, A2, min_phi, _ = R.phi_minimizer(n, edges, c)
            assert min_phi == min(phis), (name, wname)
            assert R.edge_potential(n, edges, f_star, c) == min_phi, (name, wname)
            # f* is degree-respecting and (1.1)-clean.
            deg = R.degrees(n, edges)
            assert R.violation_1_1(n, edges, f_star, deg) == 0, (name, wname)


def test_zero_violations_all_catalogue():
    """Positive control: 0 (1.1)/(1.3) violations across the whole catalogue and weights."""
    for name, n, edges, _ in R.graph_catalogue():
        for wname, c in R.WEIGHT_FUNCS.items():
            res = R.verify(n, edges, c)
            assert res["violations_1_1"] == 0, (name, wname, "1.1")
            assert res["violations_1_3"] == 0, (name, wname, "1.3")


def test_negative_control_discriminates():
    """(1.1) rejects a degree-violating permutation; (1.3) fails on a non-minimizer."""
    cat = {g[0]: g for g in R.graph_catalogue()}
    _, n, edges, _ = cat["example4_2methylbutane"]
    c = R.weight_power2
    # (1.1) rejects a degree-violating permutation.
    dv = R.find_degree_violating_permutation(n, edges)
    assert dv is not None and dv[1] > 0, dv
    # (1.3) fails on some degree-respecting non-minimizer.
    nc = R.find_negative_control(n, edges, c)
    assert nc is not None, "negative control vacuous on example4"
    f_witness, S, v13 = nc
    assert v13 > 0, nc
    deg = R.degrees(n, edges)
    assert R.violation_1_1(n, edges, f_witness, deg) == 0, "witness must be degree-respecting"


def test_remark3_equivalence():
    """Remark 3: {1,...,n} with 2^k equals 2x the I_n convention; neither rule changes.

    Using c'(i)=2^(i+1) = 2*2^i scales every neighbour sum and Phi by 2, so the set of
    valid labellings and the Phi-minimizer are unchanged.
    """
    cat = {g[0]: g for g in R.graph_catalogue()}
    _, n, edges, _ = cat["example4_2methylbutane"]
    c0 = R.weight_power2
    c1 = lambda i: 1 << (i + 1)  # 2^(i+1)
    r0 = R.verify(n, edges, c0)
    r1 = R.verify(n, edges, c1)
    assert r0["f_star"] == r1["f_star"], (r0["f_star"], r1["f_star"])
    assert r0["num_valid"] == r1["num_valid"], (r0["num_valid"], r1["num_valid"])
    assert r0["valid_labellings"] == r1["valid_labellings"]


def main():
    tests = [
        test_example4_anchor,
        test_phi_minimizer_is_minimal,
        test_zero_violations_all_catalogue,
        test_negative_control_discriminates,
        test_remark3_equivalence,
    ]
    for t in tests:
        t()
        print(f"PASS: {t.__name__}")
    print("SMOKE_OK")


if __name__ == "__main__":
    main()