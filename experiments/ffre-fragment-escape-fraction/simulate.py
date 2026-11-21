#!/usr/bin/env python3
"""FFRE Fission Fragment Escape Fraction — reproduction entry point (issue #157).

Monte Carlo ray-tracing simulation of fission fragment escape fraction from
spherical fuel domains versus domain radius R / fragment range L.

Model
-----
- Fission sites uniformly distributed within a sphere of radius R (radius r
  sampled with PDF proportional to r^2).
- Fragments emitted isotropically, travel straight lines (no scattering),
  stopped after range L.
- A fragment escapes iff its straight-line distance to the domain surface <= L.

For an emission point at radius r with direction cosine mu = cos(angle to the
outward radial direction), the distance to the sphere surface is:

    t_exit(r, mu) = -r*mu + sqrt(R^2 - r^2*(1 - mu^2))

f_escape = fraction of emitted fragments with t_exit <= L.
effective_Isp = f_escape * 1,000,000 s (ideal FFRE Isp, Clark & Sheldon 2005).

Primary results are simulated (Monte Carlo). An analytic calculated reference
is produced by exact quadrature of the same expression (labeled in the output).

All computations are in software only; no physical measurement is involved.
"""

import csv
import json
import math
import os

import numpy as np

# ---------------------------------------------------------------------------
# Physics parameters (issue #157 assumptions)
# ---------------------------------------------------------------------------
RANGE_BY_MATERIAL = {
    "UO2": 10.0e-6,   # fission fragment range in fuel, m (SRIM/TRIM literature)
    "UN":  15.0e-6,
    "UF4":  7.0e-6,
}
L_REPRESENTATIVE = 12.0e-6   # m, representative fuel (near UN)
IDEAL_ISP_S = 1.0e6          # s, ideal FFRE Isp (Clark & Sheldon 2005)
N_PARTICLES = 1_000_000      # per R/L value (stop condition: MC SE < 1%)
R_L_VALUES = np.logspace(-2, np.log10(15.0), 16)   # R/L from 0.01 to 15
CLAIMED_R_NM = 50.0          # nm, claimed nanoparticle radius upper bound
SEED = 20261121              # fixed seed: fully reproducible


def escape_fraction_mc(R, L, n_particles, rng):
    """Return (f_escape, standard_error) for one geometry via Monte Carlo."""
    # Uniform volume: r = R * u^(1/3), u ~ U[0, 1]
    r = R * rng.random(n_particles) ** (1.0 / 3.0)
    # Isotropic emission: mu = cos(theta) ~ U[-1, 1]
    mu = rng.uniform(-1.0, 1.0, n_particles)
    # Distance to sphere surface along the fragment direction
    radicand = R * R - r * r * (1.0 - mu * mu)
    t_exit = -r * mu + np.sqrt(np.maximum(radicand, 0.0))
    escaped = t_exit <= L
    f = float(escaped.mean())
    se = float(escaped.std(ddof=1) / math.sqrt(n_particles)) if n_particles > 1 else 0.0
    return f, se


def escape_fraction_calculated(R, L, n_r=200001):
    """Exact analytic escape fraction by numerical quadrature (calculated).

    Fraction of escaping directions at radius r:
        clip((1 - mu_c)/2, 0, 1),  mu_c = (R^2 - r^2 - L^2) / (2 L r)
    averaged over r with weight r^2 (uniform volume).
    """
    s = np.linspace(0.0, 1.0, n_r)
    r = R * s
    with np.errstate(divide="ignore", invalid="ignore"):
        mu_c = (R * R - r * r - L * L) / (2.0 * L * np.maximum(r, 1e-300))
    frac = np.clip((1.0 - mu_c) / 2.0, 0.0, 1.0)
    # r = 0: every direction reaches the surface at distance R
    frac[0] = 1.0 if R <= L else 0.0
    dr = r[1] - r[0]
    integral = float(
        np.sum((frac[1:] * r[1:] ** 2 + frac[:-1] * r[:-1] ** 2) * 0.5 * dr)
    )
    return 3.0 * integral / (R ** 3)


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base, "results")
    os.makedirs(results_dir, exist_ok=True)

    rng = np.random.default_rng(SEED)  # fixed seed: reproducible

    rows = []
    summary_rows = []
    all_pass = True   # f_escape >= 0.5 for all claimed R/L <= 1 cases
    claimed_fail = True  # f_escape < 0.1 for all claimed domain sizes

    def add_row(r_l, R, L, material, f_sim, se_sim, f_calc, claimed=False):
        isp_sim = f_sim * IDEAL_ISP_S
        isp_calc = f_calc * IDEAL_ISP_S
        rows.append({
            "R/L": f"{r_l:.6g}",
            "R_nm": f"{R * 1e9:.6g}",
            "L_um": f"{L * 1e6:.6g}",
            "material": material,
            "n_particles": N_PARTICLES,
            "f_escape": f"{f_sim:.8f}",
            "se": f"{se_sim:.8f}",
            "effective_Isp": f"{isp_sim:.4f}",
            "method": "simulated",
        })
        rows.append({
            "R/L": f"{r_l:.6g}",
            "R_nm": f"{R * 1e9:.6g}",
            "L_um": f"{L * 1e6:.6g}",
            "material": material,
            "n_particles": "",
            "f_escape": f"{f_calc:.8f}",
            "se": "",
            "effective_Isp": f"{isp_calc:.4f}",
            "method": "calculated",
        })
        summary_rows.append({
            "R_L": float(r_l),
            "R_nm": float(R * 1e9),
            "L_um": float(L * 1e6),
            "material": material,
            "claimed_size": claimed,
            "f_escape_sim": f_sim,
            "se_sim": se_sim,
            "f_escape_calc": f_calc,
            "effective_Isp_sim": isp_sim,
            "effective_Isp_calc": isp_calc,
        })
        return f_sim

    # --- Main sweep: R/L for representative fuel --------------------------
    for r_l in R_L_VALUES:
        L = L_REPRESENTATIVE
        R = r_l * L
        f_sim = add_row(float(r_l), R, L, "UN (representative)",
                        *escape_fraction_mc(R, L, N_PARTICLES, rng),
                        escape_fraction_calculated(R, L))
        if r_l <= 1.0 and f_sim < 0.5:
            all_pass = False

    # --- Claimed nanoparticle sizes across the three fuel materials -------
    for material, L in RANGE_BY_MATERIAL.items():
        R = CLAIMED_R_NM * 1e-9
        r_l = R / L
        f_sim = add_row(r_l, R, L, material,
                        *escape_fraction_mc(R, L, N_PARTICLES, rng),
                        escape_fraction_calculated(R, L), claimed=True)
        if f_sim >= 0.1:
            claimed_fail = False

    # --- Verdict ----------------------------------------------------------
    if all_pass:
        verdict = "supported"
    elif claimed_fail:
        verdict = "unsupported"
    else:
        verdict = "inconclusive"

    summary = {
        "verdict": verdict,
        "result_label": "simulated",
        "n_particles_per_rl": N_PARTICLES,
        "ideal_isp_s": IDEAL_ISP_S,
        "range_by_material_m": RANGE_BY_MATERIAL,
        "seed": SEED,
        "rows": summary_rows,
    }

    # --- Write raw CSV ----------------------------------------------------
    csv_path = os.path.join(results_dir, "ffre-escape-fraction.csv")
    fieldnames = ["R/L", "R_nm", "L_um", "material", "n_particles",
                  "f_escape", "se", "effective_Isp", "method"]
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # --- Machine-readable summary -----------------------------------------
    with open(os.path.join(results_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # --- Console output ---------------------------------------------------
    print("FFRE Fission Fragment Escape Fraction — issue #157")
    print("=" * 60)
    print(f"Ideal FFRE Isp: {IDEAL_ISP_S:.0f} s  |  {N_PARTICLES:,} particles per R/L  |  seed {SEED}")
    print()
    print(f"{'R/L':>8} {'R (nm)':>10} {'L (um)':>9} {'material':<18} {'method':<12} {'f_escape':>10} {'SE':>9} {'Isp_eff (s)':>12}")
    print("-" * 92)
    for row in rows:
        print(f"{row['R/L']:>8} {row['R_nm']:>10} {row['L_um']:>9} {row['material']:<18} {row['method']:<12} "
              f"{row['f_escape']:>10} {row['se']:>9} {row['effective_Isp']:>12}")
    print()
    print(f"Threshold: supported if f_escape >= 0.5 for R/L <= 1; unsupported if f_escape < 0.1.")
    print(f"Verdict: {verdict.upper()}")
    print(f"CSV written: {csv_path}")


if __name__ == "__main__":
    main()
