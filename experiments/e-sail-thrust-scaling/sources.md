# Sources — E-Sail Thrust Scaling Exponent Experiment

## Primary Sources

- **Janhunen, P. & Sandroos, A. (2007).** "Simulation study of solar wind push on a charged wire: Basis of solar wind electric sail propulsion." *Annales Geophysicae*, 25, 755–767.
  https://doi.org/10.5194/angeo-25-755-2007
  Derives the thrust-per-length estimate $dF/dz \approx 0.18\,\max(0, V_0 - V_1)\,\sqrt{\epsilon_0 m_p n}\,v_\perp$ (Eq. 2 context) for a charged wire in the solar wind, where $V_0$ is tether potential, $V_1 \approx \tfrac{1}{2}m_p v_\perp^2/e$ is the proton stopping potential, $n$ is proton density, and $v_\perp$ is perpendicular proton speed.

- **Janhunen, P. (2009).** "On the feasibility of a negative polarity electric sail." *Annales Geophysicae*, 27, 1439–1447.
  https://doi.org/10.5194/angeo-27-1439-2009
  Discusses E-sail force models and sheath/impact-parameter scaling for charged tethers.

## Supporting Sources

- **Janhunen, P. (2015).** "Boltzmann electron PIC simulation of the E-sail effect." *Ann. Geophys.*, 33, 1507–1512. arXiv:1511.00518.
  https://doi.org/10.5194/angeo-33-1507-2015
  PIC results showing the effective sheath/impact parameter depends nonlinearly on $V_0/(m_p v^2/2e)$ and trapped-electron physics — the motivation for the sensitivity (cutoff) cases.

- **Wiegmann, B. M. et al. (2017).** "Findings from NASA's 2015-2017 Electric Sail Investigations." IEPC-2017, NASA NTRS 20170012439.
  https://ntrs.nasa.gov/citations/20170012439
  Cites the engineering estimate of E-sail thrust decaying as $\sim 1/r^{7/6}$ out to ~20 AU.

- **Johnson, L. & Polzin, K. (2019).** "Electric Sail Propulsion for Deep Space Missions." IAC-19/C4/10x49175, NASA NTRS 20190032324.
  https://ntrs.nasa.gov/citations/20190032324
  Discusses the $1/r^{7/6}$ E-sail scaling vs photon sails at $1/r^2$ for deep-space mission concepts.

## Concept / Equation

The experiment implements a parametric 1D radial model:

  $n(r) = n_1\,r_{\rm AU}^{-2}$

  $T_e(r) = T_{e1}\,r_{\rm AU}^{-\beta}$

  $\lambda_D(r) = \sqrt{\epsilon_0 k_B T_e(r) / (n(r) e^2)}$

  $b_{\rm eff}(r) = C\,\lambda_D(r)$  (linear sheath-growth assumption; bounded variant $\min(C\lambda_D, b_{\max})$)

  $F'(r) = 2\,b_{\rm eff}(r)\,n(r)\,m_p\,v_{\rm sw}^2$

The radial scaling exponent $\alpha$ in $F'(r) \propto r^{-\alpha}$ is fitted by least-squares regression of $\log_{10} F'$ vs $\log_{10} r$ over $r \in [1, 20]$ AU.

Analytically, with $b_{\rm eff} \propto \lambda_D \propto \sqrt{T_e/n} \propto r^{1-\beta/2}$ and $n \propto r^{-2}$:

  $F' \propto r^{1-\beta/2} \cdot r^{-2} = r^{-(1+\beta/2)} \quad\Rightarrow\quad \alpha = 1 + \beta/2$

## Prior Work

- Janhunen & Sandroos (2007): foundational E-sail thrust model; effective momentum-transfer area grows with distance because solar wind density falls as $1/r^2$ while the sheath scale grows with Debye length.
- Wiegmann et al. (2017) / Johnson & Polzin (2019): engineering estimate $F' \sim 1/r^{7/6}$ out to ~20 AU, i.e. $\alpha \approx 1.1667$.
- Janhunen (2015): warns the impact parameter depends nonlinearly on bias and trapped-electron physics, so pure Debye-length scaling may not reproduce $7/6$ for all $\beta$.

## Notes

- All computations are performed in software only (Python, standard library).
- No physical measurement, hardware, fabrication, CAD, or real-world data collection is involved.
- All results are labeled **calculated** / **simulated**.
