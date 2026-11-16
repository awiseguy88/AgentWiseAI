#!/usr/bin/env node
/**
 * Smoke test for the Braess Paradox Demand Threshold experiment.
 * Usage: node experiments/braess-paradox-demand-threshold/test_smoke.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXP_DIR = __dirname;
const RESULTS_DIR = path.join(EXP_DIR, 'results');
const CSV_PATH = path.join(RESULTS_DIR, 'braess_results.csv');
const SUMMARY_PATH = path.join(RESULTS_DIR, 'summary.json');

let PASS = 0, FAIL = 0;
function check(cond, msg) {
  if (cond) { console.log(`  PASS: ${msg}`); PASS++; }
  else { console.log(`  FAIL: ${msg}`); FAIL++; }
}

console.log('=== Braess Paradox Smoke Test ===\n');

// 1. Run
console.log('1. Running experiment...');
try {
  const out = execSync(`node "${path.join(EXP_DIR, 'run.cjs')}"`, { encoding: 'utf8', cwd: path.dirname(path.dirname(EXP_DIR)) });
  console.log(out.trim().split('\n').slice(-3).join('\n'));
  check(true, 'Experiment exited with code 0');
} catch (e) {
  check(false, `Experiment failed: ${e.message}`);
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(1);
}

// 2. Files exist
console.log('\n2. Checking output files...');
check(fs.existsSync(CSV_PATH), 'CSV results file exists');
check(fs.existsSync(SUMMARY_PATH), 'Summary JSON exists');

// 3. Parse
console.log('\n3. Checking results content...');
const csv = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n');
const header = csv[0].split(',');
const rows = csv.slice(1).map(line => {
  const vals = line.split(',');
  const obj = {};
  header.forEach((h, i) => obj[h] = vals[i]);
  return obj;
});
check(rows.length === 150, `150 demand rows (got ${rows.length})`);
check(rows.every(r => r.converged === 'true'), 'All demands converged');

const byD = {};
rows.forEach(r => byD[parseInt(r.demand)] = r);

// 4. Key demands
console.log('\n4. Checking paradox behavior at key demands...');
check(byD[20].paradox === 'false', `At D=20, no paradox (got ${byD[20].paradox})`);
check(byD[40].paradox === 'true', `At D=40, paradox present (got ${byD[40].paradox})`);
check(byD[100].paradox === 'false', `At D=100, paradox vanishes (got ${byD[100].paradox})`);

// 5. Summary
console.log('\n5. Checking summary...');
const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
check(summary.result_label === 'calculated', "Result label is 'calculated'");
const dStar = summary.critical_demand_d_star;
check(dStar !== null, `Critical demand D* identified (got ${dStar})`);
if (dStar !== null) {
  const theoretical = 98 / 3;
  const relErr = Math.abs(dStar - theoretical) / theoretical;
  check(relErr < 0.05, `D*=${dStar} within 5% of theoretical ${theoretical.toFixed(4)} (error ${(relErr*100).toFixed(2)}%)`);
}

// 6. Sanity
console.log('\n6. Sanity checks...');
const costsWithout = rows.filter(r => r.converged === 'true').map(r => parseFloat(r.cost_without));
check(costsWithout.every(c => c > 0), 'All baseline costs positive');
const sorted = [...costsWithout].sort((a,b) => a-b);
check(JSON.stringify(costsWithout) === JSON.stringify(sorted), 'Baseline costs non-decreasing with demand');

console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);
