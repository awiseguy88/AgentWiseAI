# E-Sail Thrust Scaling Exponent — Report

**Experiment ID:** e-sail-thrust-scaling  
**GitHub Issue:** #99  
**Date:** 2026-11-16  
**Status:** COMPLETED — Supported  
**Result label:** calculated (all results computed numerically; no physical measurement)

---

## Summary

This experiment tests whether the simplified parametric E-sail sheath model with $n(r)=n_1/r^2$, constant $v_{\rm sw}$, and $b_{\rm eff}(r)=C\,\lambda_D(r)$ reproduces the cited radial thrust-decay scalings: $\alpha=2.00$ (fixed $b_{\rm eff}$ baseline), $\alpha=1.00$ (isothermal electrons, $\beta=0$), and $\alpha$ in $[1.00,1.35]$ for $T_e(r)\propto r^{-\beta}$, $\beta\in[0,0.7]$, with at least one $\beta$ giving $\alpha\approx 7/6\approx1.1667$.

**Verdict: SUPPORTED** — All five threshold conditions pass:
- Baseline (fixed $b_{\rm eff}$): $\alpha = 2.0000$ (within $2.00\pm0.01$). PASS
- Isothermal ($\beta=0$): $\alpha = 1.0000$ (within $1.00\pm0.02$). PASS
- Monotonic in $\beta$: $\alpha$ increases strictly with $\beta$ across $\{0, 0.2, 1/3, 0.5, 0.7\}$. PASS
- All $\alpha$ in $[1.00, 1.35]$: PASS
- Closest to $7/6$: $\beta = 1/3$ gives $\alpha = 1.1667$ (exact, within 5%). PASS

The exact agreement for $\beta=1/3$ follows from the analytical identity $\alpha = 1 + \beta/2$: at $\beta = 1/3$, $\alpha = 1 + 1/6 = 7/6$. All $\alpha$ values are computed numerically via least-squares log-log regression and match the analytic prediction to 8 significant figures.

---

## Method

### Governing equations

  $n(r) = n_1 / r_{\rm AU}^2$

  $v_{\rm sw} = 400\ {\rm km/s}$ (constant)

  $T_e(r) = T_{e1}\,r_{\rm AU}^{-\beta}$

  $\lambda_D(r) = \sqrt{\epsilon_0 k_B T_e(r) / (n(r) e^2)}$

  $b_{\rm eff}(r) = C\,\lambda_D(r)$ (linear sheath growth; C = 1)

  $F'(r) = 2\,b_{\rm eff}(r)\,n(r)\,m_p\,v_{\rm sw}^2$

### Analytical scaling

With $\lambda_D \propto \sqrt{T_e/n} \propto r^{1-\beta/2}$ and $n\propto r^{-2}$:

  $F' \propto r^{1-\beta/2}\cdot r^{-2} = r^{-(1+\beta/2)} \Rightarrow \alpha = 1 + \beta/2$

### Parameters and constants

| Symbol | Value |
|--------|-------|
| $n_1$ (1 AU) | $7\times10^6$ m$^{-3}$ |
| $T_{e1}$ (1 AU) | $1.5\times10^5$ K |
| $v_{\rm sw}$ | $400$ km/s |
| $m_p$ | $1.673\times10^{-27}$ kg |
| $\lambda_D(1\,{\rm AU}, \beta=0)$ | 10.1019 m |
| Radial grid | 200 log-spaced points, $r\in[1,20]$ AU |

### Fit method

Least-squares linear regression of $\log_{10} F'(r)$ vs $\log_{10} r$ over $r\in[1,20]$ AU. The slope magnitude gives $\alpha$; $R^2$ quantifies fit quality.

---

## Results (CALCULATED)

### Main cases

| Case | $\beta$ | $b_{\max}$ | $\alpha$ (fitted) | $R^2$ |
|------|---------|------------|-------------------|-------|
| Baseline (fixed $b_{\rm eff}$) | — | — | **2.000000** | 1.000000 |
| Sheath, $\beta=0$ (isothermal) | 0 | — | **1.000000** | 1.000000 |
| Sheath, $\beta=0.2$ | 0.2 | — | **1.100000** | 1.000000 |
| Sheath, $\beta=1/3$ | 0.333… | — | **1.166667** | 1.000000 |
| Sheath, $\beta=0.5$ | 0.5 | — | **1.250000** | 1.000000 |
| Sheath, $\beta=0.7$ | 0.7 | — | **1.350000** | 1.000000 |

All sheath cases have $R^2 = 1.0$ (exact power law). The fitted $\alpha$ matches $1+\beta/2$ to 8 significant figures.

### Sensitivity: bounded sheath

| Case | $\beta$ | $b_{\max}$ (m) | $\alpha$ (fitted) | $R^2$ |
|------|---------|----------------|-------------------|-------|
| Bounded $b_{\max}=30$ m | 1/3 | 30 | 1.662491 | 0.985 |
| Bounded $b_{\max}=10$ m | 1/3 | 10 | 2.000000 | 1.000 |

The bounded cases illustrate the issue's anticipated failure mode: when the sheath scale is capped (e.g., by trapped-electron physics or bias limits), the thrust decay approaches the $1/r^2$ baseline because $b_{\rm eff}$ stops growing. The $b_{\max}=30$ m case partially binds at large $r$, giving an intermediate effective exponent (1.66, $R^2=0.985$); $b_{\max}=10$ m binds everywhere, recovering $\alpha=2.00$.

---

## Sensitivity Analysis

### Electron temperature exponent $\beta$

$\alpha = 1 + \beta/2$ is linear in $\beta$ with slope $1/2$. The exponent is most sensitive to the assumed temperature profile: a fully isothermal solar wind ($\beta=0$) gives the deepest improvement over baseline ($\alpha=1$), while a strong cooling ($T_e\propto r^{-0.7}$) still yields $\alpha=1.35$, i.e., 32% slower than $1/r^2$.

### Sheath saturation ($b_{\max}$)

When the effective impact parameter saturates, the scaling degrades toward $\alpha\to2$. This captures the physical intuition that sheath growth cannot continue indefinitely; the $1/r^{7/6}$ result depends on the Debye-length growth argument remaining valid out to ~20 AU.

### Baseline comparison

| Scaling | $\alpha$ |
|---------|----------|
| Photon sail (geometric) | 2.00 |
| E-sail baseline (fixed $b_{\rm eff}$) | 2.00 |
| E-sail isothermal | 1.00 |
| E-sail cited estimate | $\approx 1.167$ |
| E-sail ($\beta=0.7$) | 1.35 |

The E-sail advantage over photon sails is the difference between $\alpha\in[1.0,1.35]$ and $\alpha=2$. Over a 20× radial span (1→20 AU), the thrust ratio advantage is $20^{2-\alpha}$: for $\alpha=7/6$, $20^{5/6}\approx 11.7\times$ more thrust at 20 AU than a $1/r^2$ law.

---

## Acceptance Checks (from experiment.yaml)

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| (1) Baseline fixed $b_{\rm eff}$ | $\alpha=2.00\pm0.01$ | **PASS** (2.0000) |
| (2) Isothermal ($\beta=0$) | $\alpha=1.00\pm0.02$ | **PASS** (1.0000) |
| (3) Monotonic in $\beta$, in $[1.00,1.35]$ | strictly increasing, in range | **PASS** |
| (4) $\beta$ giving $\alpha\approx 7/6$ | within 5% | **PASS** ($\beta=1/3$, $\alpha=1.1667$) |
| All results labeled calculated | — | **PASS** |
| Reproduction command | `python3 experiments/e-sail-thrust-scaling/run.py` | **PASS** |
| Smoke check | `python3 experiments/e-sail-thrust-scaling/test_smoke.py` | **PASS** (7/7) |

---

## Files Produced

| File | Description |
|------|-------------|
| `sources.md` | Source references (Janhunen & Sandroos 2007, Janhunen 2009, Janhunen 2015, NASA 2017, NASA 2019) |
| `experiment.yaml` | Signed hypothesis, baseline, metric, units, threshold, stop condition |
| `run.py` | Reproducible simulation (Python, standard library only) |
| `test_smoke.py` | Automated smoke test (7 checks) |
| `results/e-sail-thrust-scaling.csv` | Full radial table (all cases, 200 points each; labeled calculated) |
| `results/summary.json` | Machine-readable per-case fits, R², threshold evaluation, verdict |
| `report.md` | This report |

### Reproduction

```bash
cd <repo root>
python3 experiments/e-sail-thrust-scaling/run.py
```

Regenerates `results/e-sail-thrust-scaling.csv` and `results/summary.json`.

### Smoke test

```bash
python3 experiments/e-sail-thrust-scaling/test_smoke.py
```

**Result:** 7/7 checks pass.

---

## Discussion

The hypothesis is fully confirmed. The simplified parametric model — solar wind density $n\propto r^{-2}$, constant $v_{\rm sw}$, electron temperature $T_e\propto r^{-\beta}$, and linear sheath growth $b_{\rm eff}\propto\lambda_D\propto\sqrt{T_e/n}$ — reproduces all three claimed scalings exactly:

1. **Baseline** $\alpha=2.00$: fixed effective area recovers the photon-sail-like $1/r^2$ decay.
2. **Isothermal** $\alpha=1.00$: sheath growth ($\lambda_D\propto r$) exactly compensates one factor of $1/r$ in density, leaving $F'\propto1/r$.
3. **$1/r^{7/6}$**: intermediate cooling ($\beta=1/3$) yields $\alpha=7/6$ analytically ($\alpha=1+\beta/2$), confirming that the cited engineering estimate corresponds to a plausible slow electron-temperature decay.

The sensitivity cases show the cited $7/6$ estimate is not universal: it requires the Debye-length growth argument to hold without sheath saturation. When the impact parameter saturates (bounded $b_{\max}$), the decay approaches $1/r^2$, which is the most likely failure mode discussed in the issue (nonlinear sheath/impact-parameter dependence on $V_0/(m_p v^2/2e)$ and trapped-electron physics, per Janhunen 2015).

**Conclusion:** Under the stated assumptions, the experiment verifies the claimed E-sail radial scaling law $F'(r)\sim r^{-(1+\beta/2)}$ and confirms $1/r^{7/6}$ as a reproducible engineering estimate corresponding to $\beta=1/3$ electron-temperature decay. Results are labeled **calculated** throughout.