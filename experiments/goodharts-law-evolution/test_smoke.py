#!/usr/bin/env python3
"""Smoke test for Goodhart's Law in Evolution experiment."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from run import simulate, find_gamma_c, make_rng


def approx(a, b, tol=1e-6):
    return abs(a - b) <= tol * max(1.0, abs(b))


def test_baseline_monotonic():
    """mu=0 (phenotype=genotype) should have V_scaled decreasing in gamma
    (stronger selection = lower gamma = higher V), i.e. no Goodhart effect."""
    N = 5000
    ngen = 40
    gammas = [0.1, 0.3, 0.5, 0.7, 0.9]
    vals = []
    for g in gammas:
        seed = 42 + int(g * 1000)
        rng = make_rng(seed)
        V, _, _ = simulate(N, g, 0.0, ngen, rng, track_genealogy=False)
        vals.append(V)
    # V should be decreasing in gamma (monotonic)
    for i in range(len(vals) - 1):
        assert vals[i] > vals[i + 1], (
            f"Baseline V not monotonic decreasing in gamma: {vals}"
        )


def test_noisy_has_peak():
    """For mu=1.0, V_scaled(gamma) should exhibit an interior maximum
    (non-monotonic) within the tested gamma range."""
    N = 5000
    ngen = 40
    gammas = [0.1, 0.3, 0.5, 0.7, 0.9]
    vals = []
    for g in gammas:
        seed = 100 + int(g * 1000)
        rng = make_rng(seed)
        V, _, _ = simulate(N, g, 1.0, ngen, rng, track_genealogy=False)
        vals.append(V / (N ** 0.0))  # just V for now
    # Check for non-monotonicity: at least one local maximum that is not at the boundary
    has_peak = False
    for i in range(1, len(vals) - 1):
        if vals[i] > vals[i - 1] and vals[i] > vals[i + 1]:
            has_peak = True
            break
    # Also check that the maximum is not at the first or last index
    imax = max(range(len(vals)), key=lambda i: vals[i])
    assert imax != 0 and imax != len(vals) - 1, (
        f"No interior maximum found for mu=1.0: {vals}"
    )


def test_gamma_c_interpolation():
    """Test the gamma_c interpolation function on a simple parabola."""
    xs = [0.1, 0.2, 0.3, 0.4, 0.5]
    ys = [-1.0, -0.5, 0.0, -0.5, -1.0]  # peak at 0.3
    gc = find_gamma_c(xs, ys)
    assert gc is not None
    assert abs(gc - 0.3) <= 0.05, (gc, 0.3)


def test_adaptation_rate_positive():
    """V should be positive for reasonable parameters."""
    N = 5000
    ngen = 30
    rng = make_rng(12345)
    V, _, _ = simulate(N, 0.5, 1.0, ngen, rng, track_genealogy=False)
    assert V > 0, f"V should be positive, got {V}"


def main():
    tests = [
        test_baseline_monotonic,
        test_noisy_has_peak,
        test_gamma_c_interpolation,
        test_adaptation_rate_positive,
    ]
    for t in tests:
        t()
        print(f"PASS: {t.__name__}")
    print("SMOKE_OK")


if __name__ == "__main__":
    main()