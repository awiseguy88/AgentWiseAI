#!/usr/bin/env python3
"""Exact verification of the 50-vertex cubic counterexample to the
Domination-versus-Edge-Domination Conjecture.

Loads the graph from counterexample.edgelist, verifies its structure,
computes gamma_e(G) (edge domination number) via the exact counting proof
of the paper (Section 3), and computes gamma(G) (domination number) via
the exact set-cover recurrence of Sections 5-6 (enumerating all 2^20 clause
subsets).  Also runs an independent branch-and-bound domination search and
small-graph controls.  Standard library only.

Reproduction: python3 verify_domination.py
"""
import json
import os
import sys
import time
from array import array
from functools import lru_cache
from math import comb

BASE = os.path.dirname(os.path.abspath(__file__))
EDGELIST = os.path.join(BASE, "counterexample.edgelist")
JSON_PATH = os.path.join(BASE, "counterexample.json")
RESULTS_DIR = os.path.join(BASE, "results")


def load_graph(path):
    edges = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            u, v = map(int, line.split())
            edges.append((u, v))
    n = None
    # infer n from json or max vertex
    with open(JSON_PATH, encoding="utf-8") as f:
        d = json.load(f)
    n = d["n"]
    return n, edges, d


def build_adj(n, edges):
    adj = [set() for _ in range(n)]
    for u, v in edges:
        adj[u].add(v)
        adj[v].add(u)
    return adj


def verify_structure(n, edges, adj):
    msgs = []
    if n != 50:
        raise SystemExit("FAIL: n != 50")
    if len(edges) != 75:
        raise SystemExit("FAIL: m != 75")
    if len(set(tuple(sorted(e)) for e in edges)) != 75:
        raise SystemExit("FAIL: duplicate edges")
    for u, v in edges:
        if not (0 <= u < n and 0 <= v < n) or u == v:
            raise SystemExit("FAIL: bad edge")
    if any(len(x) != 3 for x in adj):
        raise SystemExit("FAIL: not cubic")
    # connectivity
    seen = {0}
    stack = [0]
    while stack:
        v = stack.pop()
        for u in adj[v]:
            if u not in seen:
                seen.add(u)
                stack.append(u)
    if len(seen) != n:
        raise SystemExit("FAIL: not connected")
    msgs.append("connected cubic graph: n=50, m=75")
    return msgs


def gamma_e_verification(d, adj):
    """Exact proof of gamma_e(G)=15 (Section 3):
    - M = {v_j^- v_j^+} is a maximal matching of size 15  -> gamma_e <= 15
    - In a cubic graph each edge is adjacent to at most 4 others, so one edge
      dominates at most 5 edges; with 75 edges, gamma_e >= ceil(75/5) = 15
      -> gamma_e >= 15
    Hence gamma_e = 15.  Exact (calculated)."""
    M = [tuple(e) for e in d["pair_matching"]]
    if len(M) != 15:
        raise SystemExit("FAIL: matching size != 15")
    used = set()
    Eset = {tuple(sorted(e)) for e in d["edges"]}
    for u, v in M:
        if tuple(sorted((u, v))) not in Eset:
            raise SystemExit("FAIL: matching nonedge")
        if u in used or v in used:
            raise SystemExit("FAIL: not a matching")
        used |= {u, v}
    unmatched = set(range(len(adj))) - used
    # maximality: no edge between two unmatched vertices
    for u in unmatched:
        for v in unmatched:
            if u < v and v in adj[u]:
                raise SystemExit("FAIL: matching not maximal")
    # lower bound
    nedges = len(d["edges"])
    lb = (nedges + 4) // 5  # ceil(nedges/5) since max 5 dominated per edge
    assert lb == 15, lb
    return 15, len(M), lb


def dominates(adj, D):
    dominated = set(D)
    for v in D:
        dominated.update(adj[v])
    return len(dominated) == len(adj)


def exact_gamma_lower_bound():
    """Exact finite calculation of Sections 5-6: proves gamma(G) >= 16.
    Returns (table_rows, residual_total, min_exact_total, verdict)."""
    clauses = [
        [1, 9, -11], [-4, -10, -13], [1, -9, -14], [2, 6, 14], [-5, -6, 15],
        [2, -3, 15], [3, 5, -9], [-6, -12, -15], [-1, 5, -11], [4, -7, -15],
        [-2, 8, -12], [3, 9, 11], [-4, -8, 10], [7, -8, 13], [4, 7, -13],
        [-2, -7, 14], [-3, 11, -14], [8, 10, 12], [-10, 12, 13], [-1, -5, 6],
    ]
    occ = [[] for _ in range(30)]
    for a, C in enumerate(clauses):
        for z in C:
            j = abs(z) - 1
            e = 2 * j + (1 if z > 0 else 0)
            occ[e].append(a)
    assert all(len(x) == 2 for x in occ)

    ends = []
    nbr = [0] * 20
    for a, b in occ:
        ends.append((1 << a) | (1 << b))
        nbr[a] |= 1 << b
        nbr[b] |= 1 << a
    ALL = (1 << 20) - 1

    # nu[U] = max matching size in H[U]
    nu = array("B", [0]) * (1 << 20)
    for U in range(1, 1 << 20):
        bv = U & -U
        v = bv.bit_length() - 1
        R = U ^ bv
        best = nu[R]
        X = nbr[v] & R
        while X:
            bu = X & -X
            X ^= bu
            best = max(best, 1 + nu[R ^ bu])
        nu[U] = best

    def unsafe(T):
        return [j for j in range(15)
                if not (T & ends[2 * j]) or not (T & ends[2 * j + 1])]

    def tau(T):
        U = ALL ^ T
        req = []
        for a in range(20):
            if (U >> a) & 1:
                req.append(tuple(e for e, ab in enumerate(occ) if a in ab))
        for j in unsafe(T):
            req.append((2 * j, 2 * j + 1))
        if not req:
            return 0
        cover = [0] * 30
        for r, C in enumerate(req):
            for e in C:
                cover[e] |= 1 << r

        @lru_cache(None)
        def F(R):
            if not R:
                return 0
            # branch on a requirement with fewest covering literals
            rr = min((r for r in range(len(req)) if (R >> r) & 1),
                     key=lambda r: len(req[r]))
            return 1 + min(F(R & ~cover[e]) for e in req[rr])

        return F((1 << len(req)) - 1)

    stats = [{"N": 0, "minL": 99, "res": 0, "minexact": 99} for _ in range(21)]
    t0 = time.perf_counter()
    for T in range(1 << 20):
        t = T.bit_count()
        U = ALL ^ T
        q = len(unsafe(T))
        L = t + max(U.bit_count() - nu[U], q)
        s = stats[t]
        s["N"] += 1
        s["minL"] = min(s["minL"], L)
        if L <= 15:
            s["res"] += 1
            s["minexact"] = min(s["minexact"], t + tau(T))
    dt = time.perf_counter() - t0

    assert sum(s["N"] for s in stats) == 1 << 20
    assert sum(s["res"] for s in stats) == 5931
    assert all(s["minL"] >= 16 or s["minexact"] >= 16 for s in stats)
    residual_total = sum(s["res"] for s in stats)
    min_exact = min(s["minexact"] for s in stats if s["res"] > 0)
    return stats, residual_total, min_exact, dt


def direct_domination_search(n, cover, dom_by, K):
    """Independent branch-and-bound for existence of dominating set of size K."""
    ALL = (1 << n) - 1
    memo = {}
    nodes = [0]
    witness = []

    def dfs(dom, used, stack):
        nodes[0] += 1
        if dom == ALL:
            witness.extend(stack)
            return True
        if used >= K:
            return False
        und = ALL ^ dom
        r = und.bit_count()
        if used + (r + 3) // 4 > K:
            return False
        old = memo.get(dom)
        if old is not None and old <= used:
            return False
        memo[dom] = used
        # pick undominated vertex with fewest covering literals
        tmp = und
        bestw = None
        bestkey = None
        while tmp:
            b = tmp & -tmp
            w = b.bit_length() - 1
            tmp -= b
            gains = [(cover[s] & und).bit_count() for s in dom_by[w]]
            key = (sum(gains), max(gains), w)
            if bestkey is None or key < bestkey:
                bestkey = key
                bestw = w
        cands = sorted(dom_by[bestw],
                       key=lambda s: (-(cover[s] & und).bit_count(), s))
        for s in cands:
            stack.append(s)
            if dfs(dom | cover[s], used + 1, stack):
                return True
            stack.pop()
        return False

    t0 = time.perf_counter()
    ans = dfs(0, 0, [])
    dt = time.perf_counter() - t0
    return ans, list(witness), nodes[0], len(memo), dt


def small_graph_controls():
    """Verify gamma <= gamma_e on small cubic graphs (calculated)."""
    # Graphs: (name, n, edges)
    graphs = []
    # K4
    K4 = [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)]
    graphs.append(("K4", 4, K4))
    # K_{3,3}
    K33 = []
    for i in range(3):
        for j in range(3):
            K33.append((i, 3 + j))
    graphs.append(("K_{3,3}", 6, K33))
    # 3-cube Q3
    Q3 = []
    for v in range(8):
        for k in range(3):
            w = v ^ (1 << k)
            if w > v:
                Q3.append((v, w))
    graphs.append(("Q3 (cube)", 8, Q3))
    # Petersen graph
    Petersen = []
    # outer cycle
    for i in range(5):
        Petersen.append((i, (i + 1) % 5))
    # inner star
    for i in range(5):
        Petersen.append((5 + i, 5 + (i + 2) % 5))
    # spokes
    for i in range(5):
        Petersen.append((i, 5 + i))
    graphs.append(("Petersen", 10, Petersen))

    results = []
    for name, n, edges in graphs:
        adj = [set() for _ in range(n)]
        for u, v in edges:
            adj[u].add(v)
            adj[v].add(u)
        # exact gamma via branch and bound (domination)
        cover = []
        for v in range(n):
            m = 1 << v
            for u in adj[v]:
                m |= 1 << u
            cover.append(m)
        dom_by = []
        for w in range(n):
            dom_by.append([s for s in range(n) if cover[s] >> w & 1])

        def exists_gamma(K):
            memo = {}
            nodes = [0]

            def dfs(dom, used):
                nodes[0] += 1
                if dom == (1 << n) - 1:
                    return True
                if used >= K:
                    return False
                und = (1 << n) - 1 ^ dom
                r = und.bit_count()
                if used + (r + 3) // 4 > K:
                    return False
                old = memo.get(dom)
                if old is not None and old <= used:
                    return False
                memo[dom] = used
                tmp = und
                bestw = None
                bestkey = None
                while tmp:
                    b = tmp & -tmp
                    w = b.bit_length() - 1
                    tmp -= b
                    gains = [(cover[s] & und).bit_count() for s in dom_by[w]]
                    key = (sum(gains), max(gains), w)
                    if bestkey is None or key < bestkey:
                        bestkey = key
                        bestw = w
                cands = sorted(dom_by[bestw],
                               key=lambda s: (-(cover[s] & und).bit_count(), s))
                for s in cands:
                    if dfs(dom | cover[s], used + 1):
                        return True
                return False

            return dfs(0, 0)

        gamma = None
        for K in range(1, n + 1):
            if exists_gamma(K):
                gamma = K
                break
        # exact gamma_e via min maximal matching (small graphs only) using counting+search
        # For small graphs, do exact min maximal matching by brute force over edge subsets
        # (n small enough). gamma_e = min size of a maximal matching.
        m = len(edges)
        best_ge = n
        # brute force: try all subsets of edges of increasing size
        for K in range(1, m + 1):
            found = False
            # combinations of K edges
            from itertools import combinations
            for combo in combinations(range(m), K):
                # check matching
                usedv = set()
                ok = True
                for idx in combo:
                    u, v = edges[idx]
                    if u in usedv or v in usedv:
                        ok = False
                        break
                    usedv.add(u)
                    usedv.add(v)
                if not ok:
                    continue
                # check maximal: no edge with both endpoints not in usedv
                maximal = True
                for (u, v) in edges:
                    if u not in usedv and v not in usedv:
                        maximal = False
                        break
                if maximal:
                    found = True
                    break
            if found:
                best_ge = K
                break
        ok = gamma is not None and gamma <= best_ge
        results.append((name, n, gamma, best_ge, ok))
    return results


def write_results(results_text):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, "verification.txt"), "w", encoding="utf-8") as f:
        f.write(results_text)


def main():
    n, edges, d = load_graph(EDGELIST)
    adj = build_adj(n, edges)

    print("=== Structure verification ===")
    for m in verify_structure(n, edges, adj):
        print(m)

    # gamma_e
    ge, msize, lb = gamma_e_verification(d, adj)
    print(f"\n=== Edge domination number ===")
    print(f"maximal matching M size = {msize}")
    print(f"lower bound ceil(75/5) = {lb}")
    print(f"gamma_e(G) = {ge}")

    # D0 witness
    D0 = d["dominating_witness_16"]
    assert dominates(adj, D0), "D0 does not dominate"
    print(f"\n=== Domination witness D0 ===")
    print(f"D0 = {D0}  (size {len(D0)})")
    print(f"D0 dominates all {n} vertices: True")

    # exact gamma lower bound
    print("\n=== Exact finite lower bound (Sections 5-6) ===")
    stats, residual, minexact, dt = exact_gamma_lower_bound()
    print(f"enumerated clause subsets: {1 << 20}")
    print(f"residual exact set-cover cases: {residual}")
    print(f"min exact total over residual: {minexact}")
    print(f"elapsed: {dt:.3f}s")
    print(" t   C(20,t)   min L   residual   min exact total")
    for t, s in enumerate(stats):
        ex = "-" if s["res"] == 0 else str(s["minexact"])
        print(f'{t:2d} {s["N"]:9d} {s["minL"]:7d} {s["res"]:10d} {ex:>17}')
    assert all(s["minL"] >= 16 or s["minexact"] >= 16 for s in stats)
    print("VERIFIED: every dominating set has size at least 16")

    # independent direct search
    print("\n=== Independent direct branch-and-bound ===")
    cover = []
    for v in range(n):
        msk = 1 << v
        for u in adj[v]:
            msk |= 1 << u
        cover.append(msk)
    dom_by = []
    for w in range(n):
        dom_by.append([s for s in range(n) if cover[s] >> w & 1])
    a15, w15, n15, m15, t15 = direct_domination_search(n, cover, dom_by, 15)
    a16, w16, n16, m16, t16 = direct_domination_search(n, cover, dom_by, 16)
    print(f"k=15 exists={a15} nodes={n15} memo_states={m15} seconds={t15:.6f}")
    print(f"k=16 exists={a16} nodes={n16} memo_states={m16} seconds={t16:.6f}")
    if w16:
        print("size-16 witness:", " ".join(map(str, w16)))
    assert (not a15) and a16, "direct search verification failed"
    print("DIRECT SEARCH VERIFIED: gamma(G)=16")

    gamma = 16
    print(f"\n=== Result ===")
    print(f"gamma(G) = {gamma}")
    print(f"gamma_e(G) = {ge}")
    print(f"gamma(G) > gamma_e(G): {gamma > ge}  (conjecture falsified)")

    # small-graph controls
    print("\n=== Small-graph controls (gamma <= gamma_e) ===")
    ctrl = small_graph_controls()
    for name, nn, g, ge2, ok in ctrl:
        print(f"{name}: n={nn} gamma={g} gamma_e={ge2} {'PASS' if ok else 'FAIL'}")
    assert all(c[4] for c in ctrl), "small-graph control failed"

    # write results
    lines = []
    lines.append("Domination-versus-Edge-Domination Conjecture Counterexample (50-vertex cubic)")
    lines.append("=" * 70)
    lines.append("")
    lines.append("Graph: 50 vertices, 75 edges, cubic, connected (counterexample.edgelist)")
    lines.append("")
    lines.append("gamma_e(G) = 15   (calculated)")
    lines.append("  maximal matching M = {v_j^- v_j^+ : 1<=j<=15} (size 15) verified maximal")
    lines.append("  lower bound: ceil(75/5) = 15 in every cubic graph")
    lines.append("")
    lines.append("gamma(G) <= 16   (calculated) : D0 = %s" % D0)
    lines.append("  D0 dominates all 50 vertices: True")
    lines.append("")
    lines.append("gamma(G) >= 16   (calculated)")
    lines.append(f"  clause subsets enumerated: {1 << 20}")
    lines.append(f"  residual exact set-cover cases: {residual}")
    lines.append(f"  minimum exact total over residual cases: {minexact}")
    lines.append("  all residual cases have total >= 16")
    lines.append("")
    lines.append(f"gamma(G) = {gamma}")
    lines.append(f"gamma_e(G) = {ge}")
    lines.append(f"gamma(G) > gamma_e(G) -> conjecture falsified: {gamma > ge}")
    lines.append("")
    lines.append("Independent direct branch-and-bound:")
    lines.append(f"  k=15 exists={a15} nodes={n15} memo_states={m15} seconds={t15:.6f}")
    lines.append(f"  k=16 exists={a16} nodes={n16} memo_states={m16} seconds={t16:.6f}")
    lines.append("")
    lines.append("Small-graph controls (gamma <= gamma_e):")
    for name, nn, g, ge2, ok in ctrl:
        lines.append(f"  {name}: n={nn} gamma={g} gamma_e={ge2} {'PASS' if ok else 'FAIL'}")
    lines.append("")
    lines.append("VERIFIED: every dominating set has size at least 16")
    lines.append("VERDICT: supported (calculated) - gamma_e=15 < gamma=16")
    write_results("\n".join(lines) + "\n")
    print(f"\nResults written to {os.path.join(RESULTS_DIR, 'verification.txt')}")
    print("PASS" if (ge == 15 and gamma == 16) else "FAIL")


if __name__ == "__main__":
    main()
