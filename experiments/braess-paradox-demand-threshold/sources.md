# Sources — Braess Paradox Demand Threshold Verification

## Primary Source

**Verbree, Jasper & Ashish K. Cherukuri (2023).** *Wardrop equilibrium and Braess's paradox for varying demand.*
arXiv:2310.04256, published 2023-10-06.
https://doi.org/10.48550/arxiv.2310.04256

This paper proves:
- Braess's paradox (BP) formalizes the counter-intuitive fact that for some networks, removing a path decreases congestion at Wardrop equilibrium.
- For non-atomic, single origin-destination routing games with affine cost functions, there exist sufficient conditions revealing the presence of BP.
- **Key claim tested here:** A path causing Braess's paradox at a particular demand must be strictly beneficial at a lower demand.

## Supporting Source

**Gisches, Eyran J. & Amnon Rapoport (2010).** *Degrading network capacity may improve performance: private versus public monitoring in the Braess Paradox.*
Theory and Decision, published 2010-12-14. Open access.
https://link.springer.com/article/10.1007/s11238-010-9237-0

Experimental verification of Braess paradox in laboratory settings with human subjects. Aggregate route choices converge to Wardrop equilibrium under both public and private monitoring conditions.

## Classic Reference

**Braess, D. (1968).** *Über ein Paradoxon der Verkehrsplanung.*
Unternehmensforschung 12: 258–268.
English translation: "On a paradox of traffic planning," Transportation Science 39(4): 446–450 (2005).

Original statement of the paradox: adding a new link to a traffic system can increase total travel time.

## Theory Foundation

**Roughgarden, T. & É. Tardos (2002).** *How bad is selfish routing?*
Journal of the ACM 49(2): 236–259.
https://doi.org/10.1145/506147.506153

Beckmann transformation: Wardrop equilibrium for affine costs is equivalent to minimizing a convex potential function. This enables solving Wardrop equilibrium via linear programming / convex optimization.

## Standard Braess Network Parameters (used in this experiment)

| Edge | Cost Function | Description |
|------|--------------|-------------|
| S→A | c(f) = f | top-left edge |
| A→T | c(f) = 50 | top-right edge |
| S→B | c(f) = 50 | bottom-left edge |
| B→T | c(f) = f | bottom-right edge |
| A→B | c(f) = 1 | central paradox edge |

Demand D is swept from 1 to 150 in steps of 1. Total travel cost at Wardrop equilibrium is computed for the network WITHOUT edge A→B (baseline) and WITH edge A→B (paradox variant).

## Notes

- All computations are performed in software only (Python + SciPy linprog).
- No physical measurement, hardware, or real-world data collection is involved.
- All results are labeled "calculated" or "simulated".