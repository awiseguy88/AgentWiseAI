const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function verdictClass(v) {
  if (v === 'PASS') return 'pass';
  if (v === 'FAIL') return 'fail';
  return 'inconclusive';
}

function buildHtml(report) {
  const { summary, scenarios } = report;
  const scenarioSections = scenarios.map((s) => {
    const trialRows = (s.trials || []).map((t, i) => {
      const failList = t.failures && t.failures.length
        ? `<ul>${t.failures.map((f) => `<li><strong>${esc(f.type)}</strong>: ${esc(f.message)}</li>`).join('')}</ul>`
        : '<span class="ok">All assertions passed</span>';
      return `<tr><td>${i + 1}</td><td class="${t.pass ? 'pass' : 'fail'}">${t.pass ? 'PASS' : 'FAIL'}</td><td>${failList}</td></tr>`;
    }).join('');
    const historyRows = (s.sprt.history || []).map((h) =>
      `<tr><td>${h.run}</td><td class="${h.pass ? 'pass' : 'fail'}">${h.pass ? 'pass' : 'fail'}</td><td>${h.logLikelihood.toFixed(4)}</td><td class="${verdictClass(h.verdict)}">${h.verdict}</td></tr>`
    ).join('');
    return `<section class="scenario ${verdictClass(s.sprt.verdict)}">
      <h2>${esc(s.id)} — <span class="${verdictClass(s.sprt.verdict)}">${esc(s.sprt.verdict)}</span> (${(s.sprt.confidence * 100).toFixed(1)}% confidence)</h2>
      <p class="desc">${esc(s.description || '')}</p>
      <p class="meta">Runs completed: ${s.sprt.runsCompleted}/${s.sprt.runsRequested} | p0=${s.sprt.params.p0}, p1=${s.sprt.params.p1}, α=${s.sprt.params.alpha}, β=${s.sprt.params.beta}</p>
      <details><summary>SPRT history</summary>
        <table><thead><tr><th>Run</th><th>Trial</th><th>Log-likelihood</th><th>Verdict</th></tr></thead><tbody>${historyRows}</tbody></table>
      </details>
      <details><summary>Trial assertions</summary>
        <table><thead><tr><th>Run</th><th>Result</th><th>Details</th></tr></thead><tbody>${trialRows}</tbody></table>
      </details>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Regression Suite Report</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:1000px;margin:0 auto;padding:1.5rem;color:#1a1a1a;line-height:1.45}
h1{border-bottom:2px solid #e5e7eb;padding-bottom:.4rem}
.scenario{border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:1rem 0}
.scenario.pass{border-left:6px solid #16a34a}
.scenario.fail{border-left:6px solid #dc2626}
.scenario.inconclusive{border-left:6px solid #d97706}
.pass{color:#16a34a;font-weight:600}
.fail{color:#dc2626;font-weight:600}
.inconclusive{color:#d97706;font-weight:600}
.ok{color:#16a34a}
.meta{color:#6b7280;font-size:.9rem}
table{border-collapse:collapse;width:100%;margin:.5rem 0;font-size:.9rem}
th,td{border:1px solid #e5e7eb;padding:.4rem .5rem;text-align:left;vertical-align:top}
th{background:#f9fafb}
details{margin-top:.5rem}
ul{margin:.2rem 0;padding-left:1.2rem}
</style>
</head>
<body>
<h1>Agent Regression Suite Report</h1>
<p class="meta">Generated ${esc(report.timestamp)} — fixtures: ${esc(report.fixtures || '')} — agent: ${esc(report.agent || '')} — baseline: ${esc(report.baseline || '')}</p>
<p><strong>Overall:</strong> <span class="${verdictClass(summary.overall)}">${esc(summary.overall)}</span>
— ${summary.passed} passed, ${summary.failed} failed, ${summary.inconclusive} inconclusive (${summary.total} scenarios)</p>
${scenarioSections}
</body>
</html>`;
}

function writeReports(report, outDir = 'reports/latest') {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, 'report.json');
  const htmlPath = path.join(dir, 'report.html');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(htmlPath, buildHtml(report));
  return { jsonPath, htmlPath };
}

module.exports = { writeReports, buildHtml };
