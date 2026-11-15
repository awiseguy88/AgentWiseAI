import { normalizeRun, computeSummary, weeklyTrends, parseCSV, toCSV } from './metrics.mjs';

const STORAGE_KEY = 'agent-reliability-logbook-runs-v1';
let runs = loadRuns();
let editingId = null;

const els = {
  status: document.getElementById('status'),
  form: document.getElementById('run-form'),
  formTitle: document.getElementById('form-title'),
  cancelEdit: document.getElementById('cancel-edit'),
  body: document.getElementById('runs-body'),
  total: document.getElementById('kpi-total'),
  completion: document.getElementById('kpi-completion'),
  intervention: document.getElementById('kpi-intervention'),
  duration: document.getElementById('kpi-duration'),
  failureChart: document.getElementById('failure-chart'),
  trendChart: document.getElementById('trend-chart'),
};

function loadRuns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRun) : [];
  } catch {
    return [];
  }
}

function saveRuns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

function setStatus(msg) { els.status.textContent = msg; }
function pct(v) { return `${(v * 100).toFixed(1)}%`; }

function render() {
  const summary = computeSummary(runs);
  els.total.textContent = String(summary.total);
  els.completion.textContent = pct(summary.completionRate);
  els.intervention.textContent = pct(summary.interventionRate);
  els.duration.textContent = summary.avgDuration.toFixed(1);
  renderFailures(summary.recurring);
  renderTrends(weeklyTrends(runs));
  renderTable();
}

function renderFailures(items) {
  if (!items.length) { els.failureChart.innerHTML = '<p class="muted">No failures recorded.</p>'; return; }
  const max = Math.max(...items.map((i) => i.count), 1);
  els.failureChart.innerHTML = items.map((i) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(i.category)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(i.count / max) * 100}%"></div></div>
      <div class="bar-value">${i.count}</div>
    </div>`).join('');
}

function renderTrends(trends) {
  if (!trends.length) { els.trendChart.innerHTML = '<p class="muted">No trend data yet.</p>'; return; }
  const width = 520, height = 180, pad = 30;
  const points = (key) => trends.map((t, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(trends.length - 1, 1);
    const y = height - pad - t[key] * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const labels = trends.map((t, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(trends.length - 1, 1);
    return `<text x="${x}" y="${height - 8}" text-anchor="middle" font-size="10">${t.week.slice(5)}</text>`;
  }).join('');
  els.trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-svg" role="img" aria-label="Weekly completion and intervention rates">
      <line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" stroke="#ccc" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height-pad}" stroke="#ccc" />
      <polyline fill="none" stroke="#0b6e4f" stroke-width="2" points="${points('completionRate')}" />
      <polyline fill="none" stroke="#c2410c" stroke-width="2" points="${points('interventionRate')}" />
      ${labels}
      <text x="${pad+4}" y="${pad-8}" font-size="10" fill="#0b6e4f">Completion</text>
      <text x="${pad+70}" y="${pad-8}" font-size="10" fill="#c2410c">Intervention</text>
    </svg>`;
}

function renderTable() {
  if (!runs.length) { els.body.innerHTML = '<tr><td colspan="10" class="muted">No runs yet.</td></tr>'; return; }
  els.body.innerHTML = [...runs].sort((a,b)=>b.date.localeCompare(a.date)).map((r) => `
    <tr>
      <td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.task)}</td><td>${escapeHtml(r.outcome)}</td>
      <td>${r.duration}</td><td>${r.retries}</td><td>${r.humanOverride ? 'yes' : 'no'}</td>
      <td>${escapeHtml(r.errorType)}</td><td>${r.confidence ?? ''}</td><td>${escapeHtml(r.notes)}</td>
      <td class="actions-cell">
        <button data-edit="${r.id}" type="button">Edit</button>
        <button data-del="${r.id}" type="button" class="danger">Delete</button>
      </td>
    </tr>`).join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function readForm() {
  return normalizeRun({
    id: document.getElementById('run-id').value || undefined,
    date: document.getElementById('date').value,
    task: document.getElementById('task').value,
    outcome: document.getElementById('outcome').value,
    duration: document.getElementById('duration').value,
    retries: document.getElementById('retries').value,
    humanOverride: document.getElementById('humanOverride').value,
    errorType: document.getElementById('errorType').value,
    confidence: document.getElementById('confidence').value,
    notes: document.getElementById('notes').value,
  });
}

function fillForm(run) {
  document.getElementById('run-id').value = run.id;
  document.getElementById('date').value = run.date;
  document.getElementById('task').value = run.task;
  document.getElementById('outcome').value = run.outcome;
  document.getElementById('duration').value = run.duration;
  document.getElementById('retries').value = run.retries;
  document.getElementById('humanOverride').value = String(run.humanOverride);
  document.getElementById('errorType').value = run.errorType;
  document.getElementById('confidence').value = run.confidence ?? '';
  document.getElementById('notes').value = run.notes;
}

function resetForm() {
  editingId = null;
  els.form.reset();
  document.getElementById('run-id').value = '';
  document.getElementById('date').value = new Date().toISOString().slice(0,10);
  els.formTitle.textContent = 'Add run';
  els.cancelEdit.hidden = true;
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const run = readForm();
  const idx = runs.findIndex((r) => r.id === run.id);
  if (idx >= 0) runs[idx] = run; else runs.push(run);
  saveRuns(); render(); resetForm(); setStatus('Run saved locally.');
});

els.cancelEdit.addEventListener('click', resetForm);

els.body.addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) {
    const run = runs.find((r) => r.id === edit.dataset.edit);
    if (run) { editingId = run.id; fillForm(run); els.formTitle.textContent = 'Edit run'; els.cancelEdit.hidden = false; }
  }
  if (del) {
    runs = runs.filter((r) => r.id !== del.dataset.del);
    saveRuns(); render(); setStatus('Run deleted.');
  }
});

document.getElementById('load-sample').addEventListener('click', async () => {
  const res = await fetch('./sample-runs.json');
  const data = await res.json();
  runs = data.map(normalizeRun);
  saveRuns(); render(); setStatus('Sample log loaded.');
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const imported = file.name.endsWith('.csv') ? parseCSV(text) : JSON.parse(text).map(normalizeRun);
    runs = imported;
    saveRuns(); render(); setStatus(`Imported ${runs.length} runs from ${file.name}.`);
  } catch (err) {
    setStatus(`Import failed: ${err.message}`);
  }
  e.target.value = '';
});

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('export-json').addEventListener('click', () => {
  download('agent-runs.json', JSON.stringify(runs, null, 2), 'application/json');
  setStatus('Exported JSON.');
});
document.getElementById('export-csv').addEventListener('click', () => {
  download('agent-runs.csv', toCSV(runs), 'text/csv');
  setStatus('Exported CSV.');
});
document.getElementById('clear-data').addEventListener('click', () => {
  runs = []; saveRuns(); render(); setStatus('All local data cleared.');
});

resetForm();
render();
