#!/usr/bin/env python3
"""Smoke test for Braess paradox demand threshold experiment."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from run import (
    STANDARD,
    analytical_no_edge,
    analytical_with_edge_standard,
    numerical_no_edge,
    numerical_with_edge,
    find_critical_demand,
)


def approx(a, b, tol=1e-6):
    return abs(a - b) <= tol * max(1.0, abs(b))


def test_analytical_standard_key_points():
    # D=30 (<=49): with edge, all on middle path, total cost = 30*(30+1+30)=1830
    no30 = analytical_no_edge(30, STANDARD)
    wi30 = analytical_with_edge_standard(30)
    assert approx(no30.total_cost, 30 * (15 + 50)), (no30.total_cost, 1950)
    assert approx(wi30.total_cost, 30 * 61), (wi30.total_cost, 1830)

    # D=40 (<=49): with edge 40*81=3240, without 40*70=2800
    no40 = analytical_no_edge(40, STANDARD)
    wi40 = analytical_with_edge_standard(40)
    assert approx(no40.total_cost, 40 * 70), no40.total_cost
    assert approx(wi40.total_cost, 40 * 81), wi40.total_cost

    # D=60 (49<D<98): x1=x3=11, x2=38, total = 99D = 5940
    wi60 = analytical_with_edge_standard(60)
    expected60 = 99 * 60
    assert approx(wi60.total_cost, expected60), (wi60.total_cost, expected60)

    # D=100 (>=98): equals without edge, split
    no100 = analytical_no_edge(100, STANDARD)
    wi100 = analytical_with_edge_standard(100)
    assert approx(no100.total_cost, 100 * (50 + 50)), no100.total_cost
    assert approx(wi100.total_cost, no100.total_cost), (wi100.total_cost, no100.total_cost)


def test_critical_demand_analytical():
    demands = list(range(1, 151))
    cno = [analytical_no_edge(D, STANDARD).total_cost for D in demands]
    cwi = [analytical_with_edge_standard(D).total_cost for D in demands]
    dstar = find_critical_demand(demands, cno, cwi)
    assert dstar is not None, "D* not found"
    assert abs(dstar - 98 / 3) / (98 / 3) <= 0.05, (dstar, 98 / 3)


def test_numerical_agreement():
    for D in [10, 33, 40, 60, 90, 120]:
        an_no = analytical_no_edge(D, STANDARD).total_cost
        an_wi = analytical_with_edge_standard(D).total_cost
        nu_no = numerical_no_edge(D, STANDARD).total_cost
        nu_wi = numerical_with_edge(D, STANDARD).total_cost
        assert abs(an_no - nu_no) / max(1.0, abs(an_no)) <= 0.05, (D, "no", an_no, nu_no)
        assert abs(an_wi - nu_wi) / max(1.0, abs(an_wi)) <= 0.05, (D, "wi", an_wi, nu_wi)


def main():
    tests = [
        test_analytical_standard_key_points,
        test_critical_demand_analytical,
        test_numerical_agreement,
    ]
    for t in tests:
        t()
        print(f"PASS: {t.__name__}")
    print("SMOKE_OK")


if __name__ == "__main__":
    main()
