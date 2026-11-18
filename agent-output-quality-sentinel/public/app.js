'use strict';

const API = '/api';
const els = {
  importFile: document.getElementById('importFile'),
  btnImport: document.getElementById('btnImport'),
  runsList: document.getElementById('runsList'),
  runPanel: document.getElementById('runPanel'),
  runName: document.getElementById('runName'),
  runMeta: document.getElementById('runMeta'),
  gateBadge: document.getElementById('gateBadge'),
  kpiMeanSlop: document.getElementById('kpiMeanSlop'),
  kpiMaxSlop: document.getElementById('kpiMaxSlop'),
  kpiTurns: document.getElementById('kpiTurns'),
  kpiGate: document.getElementById('kpiGate'),
  tabs: document.querySelectorAll('.tab'),
  screens: document.querySelectorAll('.screen'),
  turnsBody: document.getElementById('turnsBody'),
  trendChart: document.getElementById('trendChart'),
  gateThresholdDisplay: document.getElementById('gateThresholdDisplay')
};

let currentRunId = null;
let chart = null;

async function loadRuns() {
  const res = await fetch(`${API}/runs`);
  const runs = await res.json();
  renderRunsList(runs);
}

function renderRunsList(runs) {
  els.runsList.innerHTML = '';
  if (runs.length === 0) {
    els.runsList.innerHTML = '<div class="empty">No runs yet. Import a transcript.</div>';
    return;
  }
  for (const run of runs) {
    const item = document.createElement('div');
    item.className = `run-item${run.id === currentRunId ? ' selected' : ''}`;
    const pass = run.gate && run.gate.pass ? 'PASS' : 'FAIL';
    item.innerHTML = `
      <div>
        <div class="name">${esc(run.name || 'unnamed run')}</div>
        <div class="meta">${run.transcriptFormat || 'unknown'} · ${formatTime(run.imported_at)} · gate ${pass} · mean slop ${run.aggregate ? run.aggregate.mean_slop : '—'}</div>
      </div>
      <button class="btn-danger" title="Delete" style="display:none" onclick="event.stopPropagation(); deleteRun(${run.id});">×</button>
    `;
    item.onclick = () => loadRun(run.id);
    els.runsList.appendChild(item);
  }
}

async function loadRun(id) {
  currentRunId = id;
  const res = await fetch(`${API}/runs/${id}`);
  const run = await res.json();
  els.runPanel.style.display = 'block';
  els.runName.textContent = esc(run.name || 'unnamed run');
  const gate = run.gate || { pass: null, threshold: 60 };
  const pass = gate.pass === true ? 'PASS' : gate.pass === false ? 'FAIL' : '—';
  els.runMeta.textContent = `${run.transcriptFormat || 'unknown'} · imported ${formatTime(run.imported_at)} · ${run.sourcePath || 'local'}`;
  els.gateBadge.className = `gate-badge ${gate.pass === true ? 'gate-pass' : gate.pass === false ? 'gate-fail' : ''}`;
  els.gateBadge.textContent = `CI gate: ${pass} (threshold ${gate.threshold})`;
  els.kpiMeanSlop.textContent = run.aggregate ? run.aggregate.mean_slop : '—';
  els.kpiMaxSlop.textContent = run.aggregate ? run.aggregate.max_slop : '—';
  els.kpiTurns.textContent = run.aggregate ? run.aggregate.turn_count : 0;
  els.kpiGate.textContent = pass;
  renderTurns(run.turns || []);
  renderTrend(run.turns || []);
  switchScreen('turns');
}

function renderTurns(turns) {
  els.turnsBody.innerHTML = '';
  for (const t of turns) {
    const m = t.metrics || {};
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${t.index}</td>
      <td>${esc(t.role || 'assistant')}</td>
      <td class="num">${m.verbosity_ratio}</td>
      <td class="num">${m.redundancy}</td>
      <td class="num">${m.step_signature_repetition}</td>
      <td class="num">${m.claim_density}</td>
      <td class="num">${m.code_yield}</td>
      <td class="num${m.slop_score > 60 ? ' fail' : ''}">${m.slop_score}</td>
      <td>${esc(t.step_signature || '')}</td>
    `;
    els.turnsBody.appendChild(row);
  }
}

function renderTrend(turns) {
  const ctx = els.trendChart.getContext('2d');
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!turns.length) return;
  const scores = turns.map(t => (t.metrics && t.metrics.slop_score != null ? t.metrics.slop_score : 0));
  const maxS = Math.max(...scores, 60);
  const pad = 40;
  const plotW = width - pad;
  const plotH = height - pad;
  // axis
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, height - pad); ctx.lineTo(width - pad, height - pad); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, height - pad); ctx.stroke();
  // threshold line at 60
  const ty = height - pad - (60 / maxS) * plotH;
  ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(pad, ty); ctx.lineTo(width - pad, ty); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#b91c1c'; ctx.font = '10px sans-serif'; ctx.fillText('gate 60', pad + 4, ty - 6);
  // bars
  const barW = plotW / scores.length / 1.5;
  for (let i = 0; i < scores.length; i++) {
    const h = (scores[i] / maxS) * plotH;
    const x = pad + i * plotW / scores.length + (plotW / scores.length - barW) / 2;
    ctx.fillStyle = scores[i] > 60 ? '#b91c1c' : '#2563eb';
    ctx.fillRect(x, height - pad - h, barW, h);
    ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.fillText(i + 1, x + barW / 2 - 4, height - pad + 12);
  }
}

function switchScreen(name) {
  for (const s of els.screens) s.classList.add('hidden');
  document.getElementById(`screen-${name}`).classList.remove('hidden');
  for (const t of els.tabs) t.classList.toggle('active', t.dataset.screen === name);
}

async function importFile(file) {
  const form = new FormData();
  form.append('file', file);
  const nameInput = document.getElementById('importFile');
  const res = await fetch(`${API}/import`, { method: 'POST', body: form });
  if (!res.ok) throw new Error((await res.text()) || 'import failed');
  const result = await res.json();
  alert(`Imported "${result.name}" — ${result.turnCount} turns, mean slop ${result.aggregate.mean_slop}, gate ${result.gate.pass ? 'PASS' : 'FAIL'}`);
  await loadRuns();
  if (result.runId) await loadRun(result.runId);
}

async function deleteRun(id) {
  await fetch(`${API}/runs/${id}`, { method: 'DELETE' });
  await loadRuns();
  currentRunId = null;
  els.runPanel.style.display = 'none';
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function formatTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

els.btnImport.onclick = () => {
  const file = els.importFile.files[0];
  if (!file) return alert('Choose a transcript file first.');
  importFile(file).catch(e => alert('Import failed: ' + e.message));
};
els.importFile.onchange = () => { if (els.importFile.files[0]) importFile(els.importFile.files[0]).catch(e => alert('Import failed: ' + e.message)); };
for (const t of els.tabs) t.onclick = () => switchScreen(t.dataset.screen);

loadRuns();
