# Sources — Kármán Line Altitude Experiment

## Primary Sources

- **Wikipedia, "Kármán line".** https://en.wikipedia.org/wiki/K%C3%A1rm%C3%A1n_line
  FAI defines the Kármán line at 100 km altitude above mean sea level. Theodore von Kármán calculated a theoretical limit of altitude for aeroplane flight at 83.8 km (275,000 ft) in a 1956 paper, based on the Bell X-2's speed-to-weight ratio and aerothermal limits.

- **NASA Glenn Research Center, "Earth Atmosphere Model — Metric Units".** https://www.grc.nasa.gov/WWW/K-12/airplane/atmosmet.html
  US Standard Atmosphere density model (troposphere 0–11 km, stratosphere layers above) used to compute air density ρ(h).

## Concept / Equation

The Kármán altitude is the solution of

  (1/2) · ρ(h) · v(h)² · C_L = W/S   (wing loading)

where v(h) = sqrt(GM / (R_E + h)) is circular orbital speed, ρ(h) is standard-atmosphere density, C_L is lift coefficient, and W/S is wing loading (N/m²).

## Prior Work

- von Kármán (1956): ~83.8 km for a vehicle with the Bell X-2's speed-to-weight ratio and thermal limits of the era.
- FAI (1960s): adopted 100 km as a round-number convention for legal/regulatory purposes; explicitly acknowledged as having "no distinct physical significance."

## Constants

- Earth radius R_E = 6378 km (equatorial); GM = 3.986×10¹⁴ m³/s².
- Sea-level density ρ(0) = 1.225 kg/m³ (US Standard Atmosphere).

## Notes

- All computations are performed in software only (Python + C).
- No physical measurement, hardware, or real-world data collection is involved.
- All results are labeled **calculated** / **simulated**.
