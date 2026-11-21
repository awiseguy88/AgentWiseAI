# Sources — FFRE Fission Fragment Escape Fraction Experiment

## Primary Sources

- **Clark, G. E. & Sheldon, R. B. (2005).** "The Dusty Plasma Fission Fragment Rocket." *AIAA Paper 2005-4460*, 41st AIAA/ASME/SAE/ASEE Joint Propulsion Conference & Exhibit, Tucson, AZ.
  https://arc.aiaa.org/doi/10.2514/6.2005-4460
  Proposes a dusty-plasma fission fragment rocket engine (FFRE) with fuel nanoparticles < 100 nm, claiming specific impulse above 1,000,000 s (exhaust velocity 3–5% of c) at roughly 90% efficiency. The claim hinges on essentially all fission fragments escaping the fuel dust grains.

- **Werka, S. et al. (2012).** "FFRE: Fission Fragment Rocket Engine." *NASA NIAC Phase I Final Report*.
  https://www.nasa.gov/niac/ffre-fission-fragment-rocket-engine/
  Reports delivered Isp of 527,000 s direct and 4.5 kN thrust at 32,000 s Isp with a gas afterburner; assumes near-ideal fission fragment escape from the fuel core as the key enabler.

- **Gahl, K. et al. (2023).** "Fission Fragment Rocket Propulsion." *Frontiers in Space Technologies*, 4, 1191300.
  https://doi.org/10.3389/frspt.2023.1191300
  Confirms the NIAC performance figures and discusses the aerogel-core fuel design innovation; fragment escape from fuel domains remains the governing geometry-dependent loss.

## Concept / Equation

For a spherical fuel domain of radius R with fission sites uniformly distributed through its volume, fragments emitted isotropically in straight lines (no scattering) with fixed range L escape iff their straight-line distance to the domain surface is at most L.

For an emission point at radius r emitting at cosine mu to the outward radial direction:

  $t_{\rm exit}(r,\mu) = -r\mu + \sqrt{R^2 - r^2(1-\mu^2)}$

  escape  $\Longleftrightarrow$  $t_{\rm exit} \le L$

Averaging over $r \propto r^2$ (uniform volume) and isotropic $\mu$ gives the escape fraction $f_{\rm escape}(R/L)$. The analytic (calculated) value is obtained by numerical quadrature of that exact expression; the Monte Carlo (simulated) value samples emission points and directions directly.

  $f_{\rm escape} = \frac{3}{R^3}\int_0^R \operatorname{clip}\!\left(\frac{1-\mu_c}{2},0,1\right) r^2\,dr,
  \quad \mu_c = \frac{R^2 - r^2 - L^2}{2Lr}$

  $\mathrm{Isp}_{\rm eff} = f_{\rm escape}\times 1{,}000{,}000\ {\rm s}$

## Prior Work

- Clark & Sheldon (2005): dusty-plasma FFRE, nanoparticles < 100 nm, Isp > 1,000,000 s at ~90% efficiency — assumes ~100% fragment escape.
- Werka et al. (2012): NIAC Phase I, delivered 527,000 s Isp; 4.5 kN at 32,000 s with afterburner — near-ideal escape assumed.
- Gahl et al. (2023): confirms NIAC numbers; aerogel core enlarges effective fuel domains, making escape geometry the first-order design question.

## Notes

- All computations are performed in software only (Python 3 + numpy Monte Carlo ray tracing).
- No physical measurement, hardware, fabrication, CAD, or real-world data collection is involved.
- All results are labeled **calculated** (analytic quadrature) or **simulated** (Monte Carlo).
