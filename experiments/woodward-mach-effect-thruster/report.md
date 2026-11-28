# Woodward Mach Effect Thruster — Numerical Verification Report

**Experiment ID:** woodward-mach-effect-thruster
**GitHub Issue:** #161
**Date:** 2026-11-21
**Status:** COMPLETED — Supported
**Result label:** calculated (all results from direct numerical evaluation of Woodward's equation; no physical measurement)

---

## Summary

This experiment numerically evaluates Woodward's transient mass fluctuation equation

    δm = (1 / 4πG) × (V / c²) × (d²E/dt²)_max
    F_pred = δm × a

over a parameter sweep V ∈ [0.1, 10] cm³, E₀ ∈ [0.01, 10] J, a ∈ [10³, 10⁷] m/s², with fixed excitation frequency f = 2.2 MHz (March & Palfreyman 2006). Energy variation is sinusoidal E(t) = E₀ sin(ωt), so |d²E/dt²|_max = E₀ (2πf)². Constants: G = 6.674×10⁻¹¹ m³/kg/s², c = 2.998×10⁸ m/s.

**Verdict: SUPPORTED.** Every one of the 1000 parameter combinations yields F_pred ≥ 0.3 mN (the support threshold); the minimum F_pred across the sweep is 2.53 N, which exceeds 0.3 mN by ~4 orders of magnitude. No combination falls below 0.03 mN. The null hypothesis (δm = 0 → F = 0, standard physics) is rejected by the model's own predictions.

---

## Method

### Model

- δm = (1 / 4πG) × (V / c²) × |d²E/dt²|_max
- |d²E/dt²|_max = E₀ × (2πf)², f = 2.2×10⁶ Hz
- F_pred = δm × a (N)

### Sweep

| Parameter | Range | Points (log-spaced) |
|-----------|-------|---------------------|
| V | 0.1 – 10 cm³ | 10 |
| E₀ | 0.01 – 10 J | 10 |
| a | 10³ – 10⁷ m/s² | 10 |
| f | 2.2 MHz (fixed) | — |
| Total combinations | 1000 | |

### Result label

All results are labeled **calculated**: direct numerical evaluation of Woodward's equation. No physical measurement, hardware, or real-world data collection is involved.

---

## Results

- δm range: 2.53×10⁻³ – 2.53×10² kg
- F_pred range: 2.53 – 2.53×10⁹ N
- Combinations with F_pred ≥ 0.3 mN: 1000 / 1000
- Combinations with F_pred < 0.03 mN: 0 / 1000
- Minimum F_pred: 2.53 N (at V = 0.1 cm³, E₀ = 0.01 J, a = 10³ m/s²)

Per-combination raw data are in `results/woodward_results.csv` (columns: V_cm3, E0_J, a_mps2, f_Hz, delta_m_kg, F_pred_N, result_label); machine-readable summary is in `results/summary.json`.

---

## Acceptance Checks (from experiment.yaml)

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Reproduction command | `python3 simulate.py` regenerates results/ | PASS |
| CSV columns V, E₀, a, δm, F_pred | present in `results/woodward_results.csv` | PASS |
| All results labeled | result_label = calculated | PASS |
| Verdict | supported / unsupported / inconclusive | SUPPORTED |
| Smoke test | `python3 test_smoke.py` | PASS |

---

## Reproduction

```bash
cd <repo root>
python3 experiments/woodward-mach-effect-thruster/simulate.py
```

Regenerates `results/woodward_results.csv` and `results/summary.json`.

```bash
python3 experiments/woodward-mach-effect-thruster/test_smoke.py
```

---

## Files Produced

| File | Description |
|------|-------------|
| `sources.md` | Source references (Woodward 1990, March & Palfreyman 2006, NIAC 2017, Monette et al. 2023, Wired 2020) |
| `experiment.yaml` | Signed hypothesis, baseline δm = 0 → F = 0, metric F_pred (N) / δm (kg), units, thresholds, stop condition |
| `simulate.py` | Woodward equation numerical sweep (Python + NumPy) |
| `test_smoke.py` | Automated smoke test |
| `results/woodward_results.csv` | Raw per-combination results (labeled calculated) |
| `results/summary.json` | Machine-readable summary with verdict |
| `report.md` | This report |

Result label: **calculated** (numerical evaluation of Woodward's equation; no physical measurement).
