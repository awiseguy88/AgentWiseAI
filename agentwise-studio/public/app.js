'use strict';

const API = '/api';

const els = {
  importFile: document.getElementById('importFile'),
  btnImport: document.getElementById('btnImport'),
  runsList: document.getElementById('runsList'),
  runPanel: document.getElementById('runPanel'),
  comparePanel: document.getElementById('comparePanel'),
  runName: document.getElementById('runName'),
  runMeta: document.getElementById('runMeta'),
  kpiClaims: document.getElementById('kpiClaims'),
  kpiVerified: document.getElementById('kpiVerified'),
  kpiUnverified: document.getElementById('kpiUnverified'),
  kpiAlerts: document.getElementById('kpiAlerts'),
  kpiSteps: document.getElementById('kpiSteps'),
  claimsBody: document.getElementById('claimsBody'),
  tabs: document.querySelectorAll('.tab'),
  alertsList: document.getElementById('alertsList'),
  stepsBody: document.getElementById('stepsBody'),
  selectRunA: document.getElementById('selectRunA'),
  selectRunB: document.getElementById('selectRunB'),
  btnCompare: document.getElementById('btnCompare'),
  compareSummary: document.getElementById('compareSummary'),
  compareDetails: document.getElementById('compareDetails')
};

let currentRunId = null;
let activeTab = 'verified';
let allRuns = [];

async function loadRuns() {
  const res = await fetch(`${API}/runs`);
  allRuns = await res.json();
  renderRunsList();
  populateRunSelects();
}

function renderRunsList() {
  els.runsList.innerHTML = '';
  if (allRuns.length === 0) {
    els.runsList.innerHTML = '<div class="empty">No runs yet. Import a transcript.</div>';
    return;
  }
  for (const run of allRuns) {
    const item = document.createElement('div');
    item.className = `run-item${run.id === currentRunId ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="name">${escapeHtml(run.name || 'unnamed run')}</div>
      <div class="meta">${run.transcriptFormat || ''} · ${formatTime(run.imported_at)} · ${(run.summary && run.summary.claims ? run.summary.claims.total : 0)} claims</div>
      <button class="btn-danger" title="Delete" style="display:none" onclick="event.stopPropagation(); deleteRun(${run.id});">×</button>
    `;
    item.onclick = () => loadRun(run.id);
    els.runsList.appendChild(item);
  }
}

function populateRunSelects() {
  for (const sel of [els.selectRunA, els.selectRunB]) {
    sel.innerHTML = '<option value="">select run</option>';
    for (const run of allRuns) {
      const o = document.createElement('option');
      o.value = run.id;
      o.textContent = `${run.name || 'unnamed run'} (${formatTime(run.imported_at)})`;
      sel.appendChild(o);
    }
  }
}

async function loadRun(id) {
  currentRunId = id;
  const res = await fetch(`${API}/runs/${id}`);
  const run = await res.json();

  els.runName.textContent = run.name || 'unnamed run';
  els.runMeta.textContent = `${run.transcriptFormat || 'unknown'} · imported ${formatTime(run.imported_at)} · ${run.sourcePath || 'local'}`;
  els.runPanel.style.display = 'flex';
  els.comparePanel.style.display = 'block';

  renderClaims(run.claims || []);
  renderAlerts(run.driftAlerts || []);
  renderSteps(run.driftSteps || []);
  renderKPIs(run);
  renderRunsList();

  // default comparison: this run vs itself
  els.selectRunA.value = '';
  els.selectRunB.value = id;
}

function renderKPIs(run) {
  const c = run.summary && run.summary.claims ? run.summary.claims : { total: 0, verified: 0, unverified: 0 };
  els.kpiClaims.textContent = c.total;
  els.kpiVerified.textContent = c.verified;
  els.kpiUnverified.textContent = c.unverified;
  const d = run.summary && run.summary.drift ? run.summary.drift : { steps: 0 };
  els.kpiSteps.textContent = d.steps;
  els.kpiAlerts.textContent = run.summary && run.summary.alertCount ? run.summary.alertCount : 0;
}

function renderClaims(claims) {
  els.claimsBody.innerHTML = '';
  const filtered = claims.filter(c => activeTab === 'all' || c.status === activeTab);
  if (filtered.length === 0) {
    els.claimsBody.innerHTML = `<tr><td colspan="6" class="empty">No ${activeTab} claims.</td></tr>`;
    return;
  }
  for (const c of filtered) {
    const tr = document.createElement('tr');
    const reasonsHtml = (c.reasons || []).map(r => `<div class="reason">${escapeHtml(r)}</div>`).join('');
    tr.innerHTML = `
      <td>${c.turnIndex ?? '—'}</td>
      <td>${escapeHtml(c.claimText || '')}</td>
      <td><span style="font-size:10px;color:var(--text-muted);">${escapeHtml(c.claimType || '')}</span></td>
      <td><span class="status-badge status-${c.status}">${c.status === 'verified' ? 'Verified' : 'Unverified'}</span></td>
      <td><div class="reasons">${reasonsHtml}</div></td>
      <td><div class="excerpt">${escapeHtml(c.excerpt || '')}</div></td>
    `;
    els.claimsBody.appendChild(tr);
  }
}

function renderAlerts(alerts) {
  els.alertsList.innerHTML = '';
  if (alerts.length === 0) {
    els.alertsList.innerHTML = '<div class="empty">No drift alerts.</div>';
    return;
  }
  for (const a of alerts) {
    const div = document.createElement('div');
    div.className = `alert-item ${a.severity === 'critical' ? 'critical' : 'warning'}`;
    div.innerHTML = `<span class="type">${escapeHtml(a.type)}</span>${escapeHtml(a.message)}`;
    els.alertsList.appendChild(div);
  }
}

function renderSteps(steps) {
  els.stepsBody.innerHTML = '';
  if (steps.length === 0) {
    els.stepsBody.innerHTML = '<tr><td colspan="8" class="empty">No step data.</td></tr>';
    return;
  }
  for (const s of steps) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.step_index ?? s.index ?? '—'}</td>
      <td>${escapeHtml(s.name || 'unnamed step')}</td>
      <td>${escapeHtml(s.type || '')}</td>
      <td>${s.duration_ms != null ? s.duration_ms : '—'}</td>
      <td>${s.total_tokens != null ? s.total_tokens : '—'}</td>
      <td>${s.quality != null ? s.quality : '—'}</td>
      <td>${escapeHtml(s.span || '—')}</td>
      <td class="preview-cell">${escapeHtml(s.input_preview || '')} → ${escapeHtml(s.output_preview || '')}</td>
    `;
    els.stepsBody.appendChild(tr);
  }
}

for (const tab of els.tabs) {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    for (const t of els.tabs) t.classList.toggle('active', t === tab);
    loadRun(currentRunId);
  });
}

els.btnImport.addEventListener('click', async () => {
  const file = els.importFile.files[0];
  if (!file) return alert('Please select a transcript file.');
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`${API}/import`, { method: 'POST', body: form });
    if (!res.ok) throw new Error((await res.json()).error || 'import failed');
    const result = await res.json();
    alert(`Imported "${result.name}": ${result.verifiedCount} verified, ${result.unverifiedCount} unverified claims, ${result.alertCount} alerts.`);
    els.importFile.value = '';
    await loadRuns();
  } catch (e) {
    alert('Import error: ' + e.message);
  }
});

els.btnCompare.addEventListener('click', async () => {
  const idA = Number(els.selectRunA.value);
  const idB = Number(els.selectRunB.value);
  if (!idA || !idB) return alert('Please select both runs.');
  try {
    const res = await fetch(`${API}/compare/${idA}/${idB}`);
    const comp = await res.json();
    renderComparison(comp);
  } catch (e) {
    alert('Compare error: ' + e.message);
  }
});

function renderComparison(comp) {
  const c1 = comp.summary1 && comp.summary1.claims ? comp.summary1.claims : { total: 0, verified: 0, unverified: 0 };
  const c2 = comp.summary2 && comp.summary2.claims ? comp.summary2.claims : { total: 0, verified: 0, unverified: 0 };
  const a1 = comp.summary1 && comp.summary1.alertCount ? comp.summary1.alertCount : 0;
  const a2 = comp.summary2 && comp.summary2.alertCount ? comp.summary2.alertCount : 0;

  const verDelta = c2.verified - c1.verified;
  const unverDelta = c2.unverified - c1.unverified;

  els.compareSummary.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div style="flex:1;min-width:150px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Run A (previous)</div>
        <div style="font-size:13px;font-weight:700;">${escapeHtml(comp.run1Name)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${c1.total} claims · ${c1.verified} verified · ${c1.unverified} unverified · ${a1} alerts</div>
      </div>
      <div style="flex:1;min-width:150px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Run B (current)</div>
        <div style="font-size:13px;font-weight:700;">${escapeHtml(comp.run2Name)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${c2.total} claims · ${c2.verified} verified · ${c2.unverified} unverified · ${a2} alerts</div>
      </div>
      <div style="flex:1;min-width:150px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Change</div>
        <div style="font-size:13px;font-weight:700;">
          <span class="${verDelta>=0?'added':'removed'}">${verDelta > 0 ? '+' : ''}${verDelta} verified</span>,
          <span class="${unverDelta>0?'added':'removed'}">${unverDelta > 0 ? '+' : ''}${unverDelta} unverified</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);">alerts: ${a2 - a1 > 0 ? '+' : ''}${a2 - a1}</div>
      </div>
    </div>
  `;

  const sections = [];

  // Claims changes
  const claimParts = [];
  for (const c of (comp.claims.added || [])) claimParts.push(`<div class="compare-item"><span class="label added">+ claim added:</span> ${escapeHtml(c.claimText || '')} <span class="delta">(${escapeHtml(c.claimType || '')})</span></div>`);
  for (const c of (comp.claims.removed || [])) claimParts.push(`<div class="compare-item"><span class="label removed">− claim removed:</span> ${escapeHtml(c.claimText || '')} <span class="delta">(${escapeHtml(c.claimType || '')})</span></div>`);
  for (const ch of (comp.claims.changed || [])) {
    const b = ch.before, a = ch.after;
    claimParts.push(`<div class="compare-item"><span class="label changed">claim status changed:</span> ${escapeHtml(b.claimText || '')}<br/><span class="delta">${b.status} → ${a.status}</span></div>`);
  }
  if (claimParts.length) sections.push(`<h4>Claims</h4>${claimParts.join('')}`);

  // Alert changes
  const alertParts = [];
  for (const a of (comp.alerts.added || [])) alertParts.push(`<div class="compare-item"><span class="label added">+ alert:</span> ${escapeHtml(a.message || '')}</div>`);
  for (const a of (comp.alerts.removed || [])) alertParts.push(`<div class="compare-item"><span class="label removed">− alert:</span> ${escapeHtml(a.message || '')}</div>`);
  if (alertParts.length) sections.push(`<h4>Alerts</h4>${alertParts.join('')}`);

  // Step deltas
  const stepParts = [];
  for (const s of (comp.stepDeltas || [])) {
    stepParts.push(`<div class="compare-item">
      <span class="label">step metric delta:</span> ${escapeHtml(s.name || '')}
      <span class="delta">${s.deltaDurationMs != null ? `dur ${s.deltaDurationMs > 0 ? '+' : ''}${s.deltaDurationMs}ms` : ''} ${s.deltaTotalTokens != null ? `tokens ${s.deltaTotalTokens > 0 ? '+' : ''}${s.deltaTotalTokens}` : ''}</span>
    </div>`);
  }
  if (stepParts.length) sections.push(`<h4>Step metrics</h4>${stepParts.join('')}`);

  if (sections.length === 0) {
    sections.push('<div class="compare-item" style="color:var(--text-muted);">No differences between the two runs.</div>');
  }

  els.compareDetails.innerHTML = sections.join('');
}

async function deleteRun(id) {
  if (!confirm('Delete this run?')) return;
  await fetch(`${API}/runs/${id}`, { method: 'DELETE' });
  await loadRuns();
  if (currentRunId === id) {
    els.runPanel.style.display = 'none';
    currentRunId = null;
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

loadRuns();
