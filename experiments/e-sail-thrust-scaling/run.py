#!/usr/bin/env python3
"""E-Sail Thrust Scaling Exponent Experiment — reproduction entry point.

Implements the parametric 1D radial E-sail model from issue #99:

    n(r)   = n_1 / r_AU^2                       (solar wind proton density)
    v_sw   = 400 km/s                            (constant bulk speed)
    T_e(r) = T_e1 * r_AU^(-beta)                 (electron temperature power law)
    lambda_D(r) = sqrt(eps0 * k_B * T_e(r) / (n(r) * e^2))
    b_eff(r) = C * lambda_D(r)                   (linear sheath growth)
             or min(C * lambda_D(r), b_max)      (bounded sheath variant)
    F'(r)  = 2 * b_eff(r) * n(r) * m_p * v_sw^2  (momentum-transfer cylinder)

Cases run:
  - baseline: fixed b_eff = b0 (no sheath growth)  -> alpha expected 2.00
  - beta in {0, 0.2, 1/3, 0.5, 0.7}: b_eff = lambda_D -> alpha = 1 + beta/2
  - sensitivity: bounded b_eff = min(lambda_D, b_max) for b_max in {30, 10} m

Fits alpha by least-squares regression of log10(F') vs log10(r) over r in [1, 20] AU.
All results are CALCULATED / SIMULATED (no physical measurement).
"""

import csv
import json
import math
import os

# ---------------------------------------------------------------------------
# Physical constants and nominal solar-wind parameters (1 AU)
# ---------------------------------------------------------------------------
EPS0 = 8.8541878128e-12      # F/m  (vacuum permittivity)
KB = 1.380649e-23            # J/K  (Boltzmann constant)
E_CHARGE = 1.602176634e-19   # C    (elementary charge)
MP = 1.673e-27               # kg   (proton mass)

N1 = 7.0e6                   # m^-3   solar wind proton density at 1 AU
TE1 = 1.5e5                  # K      electron temperature at 1 AU
VSW = 4.0e5                  # m/s    solar wind bulk speed (400 km/s)

AU_M = 1.495978707e11        # m per AU

# ---------------------------------------------------------------------------
# Model functions
# ---------------------------------------------------------------------------

def n_of_r(r_au):
    """Solar wind proton density (m^-3) at r (AU): n = n_1 / r^2."""
    return N1 / (r_au * r_au)


def te_of_r(r_au, beta):
    """Electron temperature (K) at r (AU): T_e = T_e1 * r^-beta."""
    return TE1 * (r_au ** (-beta))


def lambda_D(r_au, beta):
    """Debye length (m) at r (AU) for the given electron temperature."""
    n = n_of_r(r_au)
    te = te_of_r(r_au, beta)
    return math.sqrt(EPS0 * KB * te / (n * E_CHARGE ** 2))


def b_eff_of_r(r_au, beta, b_max=None):
    """Effective impact parameter (m): b_eff = C*lambda_D, optionally bounded."""
    lam = lambda_D(r_au, beta)
    if b_max is not None:
        return min(lam, b_max)
    return lam


def f_prime(r_au, beta, b0=None, b_max=None):
    """Thrust per unit tether length F' (N/m).

    If b0 is given, use a fixed effective radius (baseline).
    Otherwise use the sheath-growth model with the given beta.
    """
    n = n_of_r(r_au)
    if b0 is not None:
        b = b0
    else:
        b = b_eff_of_r(r_au, beta, b_max)
    return 2.0 * b * n * MP * VSWRATED


# Convenience: v_sw^2
VSWRATED = VSW * VSW  # m^2/s^2


def fit_alpha(r_aus, f_primes):
    """Least-squares fit of log10(F') = -alpha*log10(r) + c.

    Returns (alpha, r_squared).
    """
    x = [math.log10(r) for r in r_aus]
    y = [math.log10(fp) for fp in f_primes]
    n = len(x)
    mx = sum(x) / n
    my = sum(y) / n
    sxx = sum((xi - mx) ** 2 for xi in x)
    sxy = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    slope = sxy / sxx
    # R^2
    ss_tot = sum((yi - my) ** 2 for yi in y)
    ss_res = 0.0
    for xi, yi in zip(x, y):
        pred = slope * xi + (my - slope * mx)
        ss_res += (yi - pred) ** 2
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 1.0
    return -slope, r2


def run_case(r_aus, beta=None, b0=None, b_max=None):
    """Run one case and fit alpha over the radial grid."""
    fps = [f_prime(r, beta, b0=b0, b_max=b_max) for r in r_aus]
    alpha, r2 = fit_alpha(r_aus, fps)
    return alpha, r2


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(base, "results")
    os.makedirs(results_dir, exist_ok=True)

    # Radial grid: 200 log-spaced points in [1, 20] AU
    r_min, r_max = 1.0, 20.0
    n_pts = 200
    log_span = math.log(r_max) - math.log(r_min)
    r_aus = [math.exp(math.log(r_min) + log_span * i / (n_pts - 1)) for i in range(n_pts)]

    beta_cases = [0.0, 0.2, 1.0 / 3.0, 0.5, 0.7]
    b_max_cases = [30.0, 10.0]  # m, bounded-sheath sensitivity

    # --- Run all cases -----------------------------------------------------
    case_results = []  # list of dicts with per-case summary
    all_rows = []      # full radial table

    # Baseline: fixed b_eff = lambda_D(1 AU, beta=0) (sheath evaluated at 1 AU, held fixed)
    b0 = lambda_D(1.0, 0.0)
    alpha_base, r2_base = run_case(r_aus, b0=b0)
    case_results.append({
        "case": "baseline_fixed_b_eff",
        "beta": None,
        "b_max_m": None,
        "b0_m": b0,
        "alpha": alpha_base,
        "r_squared": r2_base,
    })
    for r in r_aus:
        all_rows.append({
            "case": "baseline_fixed_b_eff",
            "r_AU": r,
            "n_m3": n_of_r(r),
            "Te_K": None,
            "lambda_D_m": lambda_D(r, 0.0),
            "b_eff_m": b0,
            "Fprime_N_per_m": f_prime(r, None, b0=b0),
        })

    for beta in beta_cases:
        alpha, r2 = run_case(r_aus, beta=beta)
        label = "beta_{:.4f}".format(beta) if abs(beta - 1.0/3.0) > 1e-9 else "beta_1_over_3"
        case_results.append({
            "case": "sheath_beta_" + label,
            "beta": beta,
            "b_max_m": None,
            "b0_m": None,
            "alpha": alpha,
            "r_squared": r2,
        })
        for r in r_aus:
            all_rows.append({
                "case": "sheath_beta_" + label,
                "r_AU": r,
                "n_m3": n_of_r(r),
                "Te_K": te_of_r(r, beta),
                "lambda_D_m": lambda_D(r, beta),
                "b_eff_m": b_eff_of_r(r, beta),
                "Fprime_N_per_m": f_prime(r, beta),
            })

    for b_max in b_max_cases:
        beta = 1.0 / 3.0
        alpha, r2 = run_case(r_aus, beta=beta, b_max=b_max)
        case_results.append({
            "case": "bounded_b_max_{:.0f}m".format(b_max),
            "beta": beta,
            "b_max_m": b_max,
            "b0_m": None,
            "alpha": alpha,
            "r_squared": r2,
        })
        for r in r_aus:
            all_rows.append({
                "case": "bounded_b_max_{:.0f}m".format(b_max),
                "r_AU": r,
                "n_m3": n_of_r(r),
                "Te_K": te_of_r(r, beta),
                "lambda_D_m": lambda_D(r, beta),
                "b_eff_m": b_eff_of_r(r, beta, b_max),
                "Fprime_N_per_m": f_prime(r, beta, b_max=b_max),
            })

    # --- Write full radial table CSV ---------------------------------------
    csv_path = os.path.join(results_dir, "e-sail-thrust-scaling.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "case", "r_AU", "n_m3", "Te_K", "lambda_D_m", "b_eff_m", "Fprime_N_per_m",
        ])
        writer.writeheader()
        for row in all_rows:
            writer.writerow(row)

    # --- Threshold evaluation ----------------------------------------------
    beta_rows = [c for c in case_results if c["beta"] is not None and c["b_max_m"] is None]
    # (1) baseline
    base_ok = abs(case_results[0]["alpha"] - 2.00) <= 0.01
    # (2) isothermal
    iso = next(c for c in beta_rows if abs(c["beta"]) < 1e-9)
    iso_ok = abs(iso["alpha"] - 1.00) <= 0.02
    # (3) monotonic increase with beta within [1.0, 1.35]
    sorted_betas = sorted(beta_rows, key=lambda c: c["beta"])
    alphas = [c["alpha"] for c in sorted_betas]
    monotonic = all(alphas[i] < alphas[i + 1] for i in range(len(alphas) - 1))
    in_range = all(1.00 <= a <= 1.35 for a in alphas)
    # (4) at least one beta within 5% of 7/6
    target = 7.0 / 6.0
    closest = min(beta_rows, key=lambda c: abs(c["alpha"] - target))
    closest_within_5pct = abs(closest["alpha"] - target) / target <= 0.05

    pass_all = base_ok and iso_ok and monotonic and in_range and closest_within_5pct
    if not pass_all:
        # Distinguish FAIL vs INCONCLUSIVE: fits must be stable (R^2 > 0.99 for power-law cases)
        stable = all(c["r_squared"] > 0.99 for c in beta_rows + [case_results[0]])
        verdict = "unsupported" if stable else "inconclusive"
    else:
        verdict = "supported"

    summary = {
        "verdict": verdict,
        "result_label": "calculated",
        "n_points_per_case": n_pts,
        "r_range_AU": [r_min, r_max],
        "constants": {
            "n_1AU_m3": N1,
            "Te_1AU_K": TE1,
            "v_sw_m_s": VSW,
            "m_p_kg": MP,
        },
        "cases": case_results,
        "thresholds": {
            "baseline_alpha_2.00_pm_0.01": {"value": case_results[0]["alpha"], "ok": base_ok},
            "isothermal_alpha_1.00_pm_0.02": {"value": iso["alpha"], "ok": iso_ok},
            "monotonic_in_beta": {"ok": monotonic, "alphas": alphas},
            "alpha_in_1.00_1.35": {"ok": in_range},
            "closest_to_7_over_6": {
                "case": closest["case"],
                "alpha": closest["alpha"],
                "target": target,
                "within_5pct": closest_within_5pct,
            },
        },
        "verdict": verdict,
    }
    with open(os.path.join(results_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # --- Console output -----------------------------------------------------
    print("E-Sail Thrust Scaling Exponent — CALCULATED results")
    print("=" * 60)
    print(f"Constants: n1={N1} m^-3, Te1={TE1} K, v_sw={VSW} m/s, mp={MP} kg")
    print(f"Baseline fixed b_eff = lambda_D(1AU, beta=0) = {b0:.4f} m")
    print()
    for c in case_results:
        print(f"{c['case']:28s} alpha = {c['alpha']:.6f}   R^2 = {c['r_squared']:.8f}")
    print()
    print(f"(1) Baseline alpha = 2.00 +/- 0.01 : {'PASS' if base_ok else 'FAIL'} ({case_results[0]['alpha']:.4f})")
    print(f"(2) Isothermal alpha = 1.00 +/- 0.02: {'PASS' if iso_ok else 'FAIL'} ({iso['alpha']:.4f})")
    print(f"(3) Monotonic in beta              : {'PASS' if monotonic else 'FAIL'} ({alphas})")
    print(f"(4) alpha in [1.00, 1.35]          : {'PASS' if in_range else 'FAIL'}")
    print(f"(5) Closest to 7/6 ~ 1.1667        : {'PASS' if closest_within_5pct else 'FAIL'} ({closest['case']} alpha={closest['alpha']:.4f})")
    print()
    print(f"VERDICT: {verdict}")


if __name__ == "__main__":
    main()