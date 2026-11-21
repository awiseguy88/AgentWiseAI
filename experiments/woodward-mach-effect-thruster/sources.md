# Sources — Woodward Mach Effect Thruster Numerical Verification

## Primary Sources

- **J. F. Woodward, "A new experimental approach to Mach's principle and relativistic gravitation", *Foundations of Physics Letters* 3(5):497–506 (1990).** DOI: 10.1007/BF00665932
  Original transient mass fluctuation hypothesis based on Mach's principle. Proposes that energy fluctuations in a capacitor produce a transient mass fluctuation δm = (1/4πG) × (V/c²) × (d²E/dt²).

- **P. March & A. Palfreyman, "The Woodward effect: Math modeling and continual experimental verifications at 2–4 MHz", *AIP Conference Proceedings* 813:1321–1332 (2006).** DOI: 10.1063/1.2169317
  Mathematical model integrating engineering parameters; claimed experimental thrust of ±3.14 mN at 2.2 MHz. Reports a 1–2 orders of magnitude discrepancy between model predictions and claimed experimental thrust.

- **NIAC 2017 Phase I (Woodward & Fearn): MEGA drive concept; SSI Lambda interstellar probe.** NASA Innovative Advanced Concepts (NIAC) Phase I study on Mach Effect Gravitational Assist (MEGA) drive and interstellar probe concepts.

- **M. Monette, M. Stark & M. Tajmar, "Centrifugal balance for detecting mass fluctuations in advanced propulsion", *Acta Astronautica* 212:270–283 (2023).** DOI: 10.1016/j.actaastro.2023.07.046
  Centrifugal balance experiments for detecting mass fluctuations in advanced propulsion concepts.

- **Wired (2020): "Gravity, Gizmos, and a Grand Theory of Interstellar Travel".** Mixed test results, small forces, need for independent replication.

## Concept / Model

Woodward's transient mass fluctuation hypothesis: rapid energy fluctuation in a capacitor (d²E/dt²) produces a transient mass fluctuation δm. When combined with synchronous mechanical oscillation (acceleration a), net thrust F ≈ δm × a is produced without propellant.

- δm = (1/4πG) × (V/c²) × (d²E/dt²)
- For sinusoidal E(t) = E₀ sin(ωt): |d²E/dt²|_max = E₀ ω², ω = 2πf
- f = 2.2 MHz (March & Palfreyman 2006)
- G = 6.674×10⁻¹¹ m³/kg/s², c = 2.998×10⁸ m/s

## Constants and Conventions

- Volume V in cm³ (swept 0.1–10 cm³) converted to m³
- Energy E₀ in Joules (swept 0.01–10 J)
- Acceleration a in m/s² (swept 10³–10⁷)
- Frequency f = 2.2 MHz fixed
- Thrust F_pred = δm × a (N)
- Result label: calculated (numerical evaluation of the formula; no physical measurement)

## Notes

- All computations are performed in software only (Python + NumPy).
- No physical measurement, hardware, or real-world data collection is involved.
- All results are labeled **calculated** (direct numerical evaluation of Woodward's equation).
- Baseline (null): δm = 0 → F = 0 (standard physics, no transient mass fluctuation).
