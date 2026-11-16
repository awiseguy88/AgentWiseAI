#!/usr/bin/env node
/**
 * Braess Paradox Demand Threshold Verification Experiment (Node.js)
 *
 * Reproduces Wardrop equilibrium total travel cost for the classic Braess network
 * with and without the central paradox edge A->B, sweeps demand D from 1 to 150.
 * All results are calculated/simulated.
 */

const fs = require('fs');
const path = require('path');

const NODES = ['S', 'A', 'B', 'T'];

const EDGES_WITHOUT = [
  ['S', 'A', 1.0, 0.0], // c(f)=f
  ['A', 'T', 0.0, 50.0],
  ['S', 'B', 0.0, 50.0],
  ['B', 'T', 1.0, 0.0],
];

const EDGES_WITH = [
  ['S', 'A', 1.0, 0.0],
  ['A', 'T', 0.0, 50.0],
  ['S', 'B', 0.0, 50.0],
  ['B', 'T', 1.0, 0.0],
  ['A', 'B', 0.0, 1.0], // c(f)=1
];

function enumerateSimplePaths(edges) {
  const adj = {};
  NODES.forEach(n => adj[n] = []);
  edges.forEach((e, i) => adj[e[0]].push([e[1], i]));

  const paths = [];
  function dfs(node, visited, pathEdges) {
    if (node === 'T') {
      paths.push([...pathEdges]);
      return;
    }
    for (const [neighbor, eIdx] of adj[node]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        pathEdges.push(eIdx);
        dfs(neighbor, visited, pathEdges);
        pathEdges.pop();
        visited.delete(neighbor);
      }
    }
  }
  dfs('S', new Set(['S']), []);
  return paths;
}

function potential(h, pathEdges, edges) {
  const nEdges = edges.length;
  const f = new Array(nEdges).fill(0);
  for (let p = 0; p < h.length; p++) {
    for (const e of pathEdges[p]) f[e] += h[p];
  }
  let cost = 0;
  for (let i = 0; i < nEdges; i++) {
    const a = edges[i][2], b = edges[i][3];
    cost += b * f[i] + 0.5 * a * f[i] * f[i];
  }
  return cost;
}

function gradient(h, pathEdges, edges) {
  const nEdges = edges.length;
  const nPaths = h.length;
  const f = new Array(nEdges).fill(0);
  for (let p = 0; p < nPaths; p++) {
    for (const e of pathEdges[p]) f[e] += h[p];
  }
  const df = new Array(nEdges).fill(0);
  for (let i = 0; i < nEdges; i++) {
    const a = edges[i][2], b = edges[i][3];
    df[i] = b + a * f[i];
  }
  const grad = new Array(nPaths).fill(0);
  for (let p = 0; p < nPaths; p++) {
    let g = 0;
    for (const e of pathEdges[p]) g += df[e];
    grad[p] = g;
  }
  return grad;
}

function projectSimplex(v, D) {
  // Project v onto simplex {h >= 0, sum(h)=D}
  const n = v.length;
  const u = [...v].sort((a, b) => b - a);
  let cssv = 0;
  let rho = -1;
  for (let j = 0; j < n; j++) {
    cssv += u[j];
    if (u[j] - (cssv - D) / (j + 1) > 0) rho = j;
  }
  let theta = 0;
  if (rho >= 0) {
    let sumRho = 0;
    for (let j = 0; j <= rho; j++) sumRho += u[j];
    theta = (sumRho - D) / (rho + 1);
  }
  const w = v.map(x => Math.max(x - theta, 0));
  // Fix numerical drift
  const s = w.reduce((a, b) => a + b, 0);
  if (s > 0) return w.map(x => x * D / s);
  return new Array(n).fill(D / n);
}

function solveWardrop(demand, edges) {
  const paths = enumerateSimplePaths(edges);
  const nPaths = paths.length;
  if (nPaths === 0) return { success: false };

  let h = new Array(nPaths).fill(demand / nPaths);
  let step = 1.0;
  let prevObj = potential(h, paths, edges);
  let converged = false;

  for (let iter = 0; iter < 20000; iter++) {
    const g = gradient(h, paths, edges);
    const hNew = projectSimplex(h.map((hi, i) => hi - step * g[i]), demand);
    const objNew = potential(hNew, paths, edges);

    if (objNew <= prevObj + 1e-14) {
      h = hNew;
      const diff = Math.abs(prevObj - objNew);
      prevObj = objNew;
      if (diff < 1e-12) { converged = true; break; }
      step = Math.min(step * 1.05, 10.0);
    } else {
      step *= 0.5;
      if (step < 1e-16) { h = hNew; prevObj = objNew; converged = true; break; }
    }
  }

  // Compute edge flows and total cost
  const nEdges = edges.length;
  const f = new Array(nEdges).fill(0);
  for (let p = 0; p < nPaths; p++) {
    for (const e of paths[p]) f[e] += h[p];
  }
  let totalCost = 0;
  for (let i = 0; i < nEdges; i++) {
    const a = edges[i][2], b = edges[i][3];
    totalCost += f[i] * (a * f[i] + b);
  }

  // Validate Wardrop conditions (used paths should have equal cost)
  const pathCosts = paths.map(p => {
    let c = 0;
    for (const e of p) c += edges[e][2] * f[e] + edges[e][3];
    return c;
  });
  const usedCosts = pathCosts.filter((_, i) => h[i] > 1e-6);
  const maxUsed = Math.max(...usedCosts);
  const minUsed = Math.min(...usedCosts);
  if (maxUsed - minUsed > 1e-4 * Math.max(1, maxUsed)) {
    converged = false;
  }

  return { f, h, totalCost, pathCosts, paths, converged };
}

function runExperiment() {
  const results = [];
  for (let D = 1; D <= 150; D++) {
    const base = solveWardrop(D, EDGES_WITHOUT);
    const withEdge = solveWardrop(D, EDGES_WITH);
    if (!base.converged || !withEdge.converged) {
      results.push({
        demand: D, cost_without: null, cost_with: null,
        paradox: null, cost_difference: null, converged: false, error: 'solver did not converge'
      });
    } else {
      const paradox = withEdge.totalCost > base.totalCost + 1e-9;
      results.push({
        demand: D,
        cost_without: Math.round(base.totalCost * 1e6) / 1e6,
        cost_with: Math.round(withEdge.totalCost * 1e6) / 1e6,
        paradox,
        cost_difference: Math.round((withEdge.totalCost - base.totalCost) * 1e6) / 1e6,
        converged: true,
        error: null
      });
    }
  }
  return results;
}

function findCriticalDemand(results) {
  let prev = null;
  for (const r of results) {
    if (!r.converged) continue;
    if (prev !== null && prev === false && r.paradox === true) return r.demand - 1;
    prev = r.paradox;
  }
  return null;
}

function main() {
  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });

  const results = runExperiment();

  // CSV
  const csvPath = path.join(outDir, 'braess_results.csv');
  const header = 'demand,cost_without,cost_with,paradox,cost_difference,converged,error';
  const rows = results.map(r =>
    [r.demand, r.cost_without, r.cost_with, r.paradox, r.cost_difference, r.converged, r.error ?? ''].join(',')
  );
  fs.writeFileSync(csvPath, [header, ...rows].join('\n') + '\n');

  const dStar = findCriticalDemand(results);
  const paradoxRange = results.filter(r => r.converged && r.paradox).map(r => r.demand);
  const nonParadoxRange = results.filter(r => r.converged && !r.paradox).map(r => r.demand);
  const nonConverged = results.filter(r => !r.converged).map(r => r.demand);

  const summary = {
    demand_range: [1, 150],
    critical_demand_d_star: dStar,
    theoretical_d_star: 98 / 3,
    paradox_range: paradoxRange,
    non_paradox_range: nonParadoxRange,
    non_converged: nonConverged,
    result_label: 'calculated',
    notes: 'All results calculated via Wardrop equilibrium solver (Beckmann transformation, projected gradient). Node.js implementation.'
  };
  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('=== Braess Paradox Demand Threshold Verification ===');
  console.log('Demand range: 1 to 150');
  console.log(`Critical demand D* (computed): ${dStar}`);
  console.log(`Theoretical D* = 98/3 = ${(98/3).toFixed(4)}`);
  if (dStar !== null) {
    const relErr = Math.abs(dStar - 98/3) / (98/3);
    console.log(`Relative error: ${relErr.toFixed(4)} (${(relErr*100).toFixed(2)}%)`);
  }
  console.log(`Paradox demands count: ${paradoxRange.length} (range ${paradoxRange[0]}..${paradoxRange[paradoxRange.length-1]})`);
  console.log(`Non-paradox demands count: ${nonParadoxRange.length}`);
  console.log(`Non-converged: ${JSON.stringify(nonConverged)}`);
  console.log(`Results: ${csvPath}`);
  console.log(`Summary: ${summaryPath}`);

  console.log('\n=== Verdict ===');
  if (dStar !== null) {
    const relErr = Math.abs(dStar - 98/3) / (98/3);
    if (relErr < 0.05) {
      console.log('SUPPORTED: Critical demand D* matches theoretical 98/3 within 5% tolerance.');
    } else {
      console.log(`INCONCLUSIVE: D* = ${dStar}, relative error ${(relErr*100).toFixed(2)}% exceeds 5%.`);
    }
  } else {
    console.log('INCONCLUSIVE: No critical demand identified.');
  }
}

main();
