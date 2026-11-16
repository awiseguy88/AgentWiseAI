#!/usr/bin/env python3
"""Kármán Line Altitude Experiment — reproduction entry point.

Computes the Kármán altitude h for a vehicle flying at circular orbital speed,
sweeping wing loading W/S and lift coefficient C_L, using the NASA Glenn
"Earth Atmosphere Model - Metric Units" density model (0-11 km troposphere,
11-25 km lower stratosphere, 25+ km upper stratosphere). All results are
calculated/simulated.
"""

import csv
import json
import math
import os

GM = 3.986e14          # m^3/s^2
RE = 6378000.0         # m
R_GAS = 0.2869         # kJ/(kg K) -> J/(kg K) via pressure in kPa
G0 = 9.80665           # m/s^2


def density(h):
    """NASA GRC atmosphere density (kg/m^3) at geometric altitude h (m)."""
    if h < 11000.0:
        T = 15.04 - 0.00649 * h
        p = 101.29 * ((T + 273.1) / 288.08) ** 5.256
    elif h < 25000.0:
        T = -56.46
        p = 22.65 * math.exp(1.73 - 0.000157 * h)
    else:
        T = -131.21 + 0.00299 * h
        p = 2.488 * ((T + 273.1) / 216.6) ** (-11.388)
    return p / (R_GAS * (T + 273.1))


def orbital_speed(h):
    return math.sqrt(GM / (RE + h))


def karman_altitude(ws, cl):
    """Solve 0.5*rho(h)*v(h)^2*cl = ws for h (m) via bisection."""
    target = 2.0 * ws / cl  # rho*v^2 must equal this

    def f(h):
        return density(h) * (orbital_speed(h) ** 2) - target

    lo, hi = 0.0, 120000.0
    if f(lo) <= 0:
        return None
    if f(hi) >= 0:
        return None
    for _ in range(80):
        mid = (lo + hi) / 2.0
        if f(mid) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base, "results")
    os.makedirs(results_dir, exist_ok=True)

    # Density validation
    rho0 = density(0.0)
    rho0_ok = abs(rho0 - 1.225) / 1.225 < 0.01

    # Sweep
    ws_values = [250, 500, 750, 1000, 1500, 2000, 2500]
    cl_values = [0.5, 1.0, 1.5, 2.0]

    rows = []
    for ws in ws_values:
        for cl in cl_values:
            ratio = ws / cl
            h_m = karman_altitude(ws, cl)
            h_km = h_m / 1000.0 if h_m is not None else None
            rows.append({
                "wing_loading_N_m2": ws,
                "lift_coefficient": cl,
                "ratio_WS_over_CL": ratio,
                "karman_altitude_m": h_m,
                "karman_altitude_km": h_km,
            })

    csv_path = os.path.join(results_dir, "karman_results.csv")
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows:
            w.writerow(r)

    # Threshold check
    threshold_ratios = [r for r in rows if 250 <= r["ratio_WS_over_CL"] <= 2500]
    in_range = [
        r for r in threshold_ratios
        if r["karman_altitude_km"] is not None and 70 <= r["karman_altitude_km"] <= 90
    ]
    all_in = len(in_range) == len(threshold_ratios) and len(threshold_ratios) > 0
    verdict = "supported" if (all_in and rho0_ok) else "unsupported"

    summary = {
        "rho0_kg_m3": rho0,
        "rho0_within_1pct": rho0_ok,
        "num_sweep_points": len(rows),
        "threshold_points": len(threshold_ratios),
        "threshold_points_in_range": len(in_range),
        "verdict": verdict,
        "result_label": "calculated",
    }
    with open(os.path.join(results_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    print(f"rho(0) = {rho0:.4f} kg/m^3 (within 1%: {rho0_ok})")
    print(f"Sweep points: {len(rows)}; threshold-range points in [70,90] km: {len(in_range)}/{len(threshold_ratios)}")
    print(f"Verdict: {verdict}")
    print("Sample (W/S=2500, C_L=1.0): h = {:.2f} km".format(
        next(r["karman_altitude_km"] for r in rows if r["wing_loading_N_m2"] == 2500 and r["lift_coefficient"] == 1.0)))


if __name__ == "__main__":
    main()