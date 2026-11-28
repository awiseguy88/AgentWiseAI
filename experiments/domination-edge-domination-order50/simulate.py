#!/usr/bin/env python3
"""Entry point for the 50-vertex cubic domination counterexample experiment.

Reproduces the finite calculation of arXiv:2609.10783 (Sections 2-7, Appendix A):
constructs the 50-vertex cubic graph from counterexample.edgelist, verifies the
15-edge maximal matching M (gamma_e = 15), verifies the explicit 16-vertex
dominating witness D0, and runs the exact 2^20 clause-subset enumeration with the
5,931 residual set-cover cases to confirm no dominating set of size <= 15.

This is a thin wrapper around verify_domination.py so that both
`python3 simulate.py` and `python3 verify_domination.py` reproduce the result.
Standard library only.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import verify_domination  # noqa: E402

if __name__ == "__main__":
    verify_domination.main()