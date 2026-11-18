'use strict';

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t}`);
  try { return JSON.parse(t); } catch { return t; }
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function badge(status) {
  const map = { ok: 'ok', pass: 'ok', breached: 'bad', fail: 'bad', regressed: 'bad', error: 'bad', new: 'neutral' };
  return `<span class="badge ${map[status] || 'neutral'}">${esc(status)}</span>`;
}

async function loadConfig() {
  const cfg = await fetchJson('/api/config');
  const aliasEl = document.getElementById('alias');
  if (aliasEl && cfg.alias) aliasEl.textContent = cfg.alias;
  const cfgPre = document.getElementById('config');
  if (cfgPre) cfgPre.textContent = JSON.stringify({
    alias: cfg.alias, cron: cfg.cron, thresholds: cfg.thresholds,
    baseline_id: cfg.baseline_id, baseline_tasks: cfg.baseline_tasks,
    has_baseline: cfg.has_baseline,
  }, null, 2);
  const alertPre = document.getElementById('alerts-config');
  if (alertPre) alertPre.textContent = JSON.stringify(cfg.alerts || [], null, 2);
}

async function loadRuns() {
  const data = await fetchJson('/api/runs?limit=200');
  const runs = data.runs || [];
  const tbody = document.querySelector('#runs-table tbody');
  if (!tbody) return;
  if (runs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="muted">No runs yet. Click "Run suite now" to generate the first run.</td></tr>';
    return;
  }
  tbody.innerHTML = runs.map(r => `
    <tr>
      <td><a href="#run/${esc(r.id)}" class="run-link" data-id="${esc(r.id)}">${esc(r.id)}</a></td>
      <td>${esc(r.alias || '—')}</td>
      <td>${esc(new Date(r.at).toLocaleString())}</td>
      <td>${r.pass_count}</td>
      <td>${r.fail_count}</td>
      <td>${r.regressed_count}</td>
      <td>${r.pass_count != null && (r.pass_count + r.fail_count) > 0 ? ((r.pass_count / (r.pass_count + r.fail_count)) * 100).toFixed(1) + '%' : '—'}</td>
      <td>${Number(r.drift_score || 0).toFixed(3)}</td>
      <td>${badge(r.threshold_breached ? 'breached' : 'ok')}</td>
      <td>${badge(r.alerted ? 'ok' : 'neutral')}</td>
    </tr>
  `).join('');
  // bind run detail clicks
  tbody.querySelectorAll('.run-link').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); loadRunDetail(a.dataset.id);
  }));
}

async function loadRunDetail(id) {
  const panel = document.getElementById('detail-panel');
  const detail = document.getElementById('detail');
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  detail.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const data = await fetchJson(`/api/runs/${encodeURIComponent(id)}`);
    const run = data.run;
    if (!run) { detail.innerHTML = '<p class="muted">Run not found.</p>'; return; }
    const summary = run.summary || {};
    detail.innerHTML = `
      <p><b>Alias:</b> ${esc(run.alias || '—')} &nbsp; <b>At:</b> ${esc(run.at)} &nbsp; <b>Adapter:</b> ${esc(run.adapter || '—')}</p>
      <p><b>Pass:</b> ${summary.pass_count || 0} &nbsp; <b>Fail:</b> ${summary.fail_count || 0} &nbsp; <b>Regressed:</b> ${summary.regressed_count || 0} &nbsp; <b>Breached:</b> ${badge(run.threshold_breached ? 'breached' : 'ok')}</p>
      ${run.threshold_reasons && run.threshold_reasons.length ? `<p><b>Threshold breaches:</b> ${esc(run.threshold_reasons.join('; '))}</p>` : ''}
      <div class="run-detail-grid">
        ${(run.results || []).map(r => {
          const status = r.regressed ? 'regressed' : (r.passed ? 'pass' : 'fail');
          const diff = r.diff && r.diff.summary ? esc(r.diff.summary) : '';
          return `<div class="task-card">
            <div class="task-id">${esc(r.task_id)}</div>
            <div class="task-title">${esc(r.title || '')}</div>
            <div>${badge(status)} &nbsp; drift=${Number(r.drift_score || 0).toFixed(3)}</div>
            ${diff ? `<div class="diff">${diff}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    `;
  } catch (e) {
    detail.innerHTML = `<p class="muted">Error: ${esc(e.message)}</p>`;
  }
}

function renderChart(points, baselinePassRate) {
  const el = document.getElementById('chart');
  if (!el) return;
  if (!points || points.length === 0) {
    el.innerHTML = '<p class="empty-state">No run data yet. Run the suite to start building the drift trend.</p>';
    return;
  }
  const W = 1000, H = 300, padL = 60, padR = 20, padT = 20, padB = 40;
  const maxX = Math.max(points.length - 1, 1);
  const maxPass = 1.0;
  const x = i => padL + (i / maxX) * (W - padL - padR);
  const y = v => H - padB - (v / maxPass) * (H - padT - padB);

  // grid lines
  const grids = [];
  for (let v = 0; v <= 1.01; v += 0.25) {
    grids.push(`<line x1="${padL}" y1="${y(v)}" x2="${W-padR}" y2="${y(v)}" stroke="#2d333b" stroke-width="1"/>`);
    grids.push(`<text x="${padL-8}" y="${y(v)+4}" text-anchor="end" fill="#8b949e" font-size="11">${(v*100).toFixed(0)}%</text>`);
  }

  // baseline dashed line
  let baselineLine = '';
  if (baselinePassRate != null) {
    baselineLine = `<line x1="${padL}" y1="${y(baselinePassRate)}" x2="${W-padR}" y2="${y(baselinePassRate)}" stroke="#d29922" stroke-width="1.5" stroke-dasharray="6,3"/>`;
    baselineLine += `<text x="${W-padR-4}" y="${y(baselinePassRate)-6}" text-anchor="end" fill="#d29922" font-size="11">baseline ${(baselinePassRate*100).toFixed(0)}%</text>`;
  }

  // series line + points
  let seriesPath = '';
  let pointsHtml = '';
  const breachedColor = '#f85149';
  const normalColor = '#58a6ff';
  points.forEach((p, i) => {
    const px = x(i), py = y(p.pass_rate || 0);
    if (i === 0) seriesPath += `M${px} ${py}`;
    else seriesPath += ` L${px} ${py}`;
    const color = p.threshold_breached ? breachedColor : normalColor;
    pointsHtml += `<circle cx="${px}" cy="${py}" r="${p.threshold_breached ? 6 : 4}" fill="${color}" stroke="#1a2129" stroke-width="2"/>`;
  });

  // regressed count bars (optional)
  let bars = '';
  if (points.some(p => p.regressed_count > 0)) {
    const maxReg = Math.max(...points.map(p => p.regressed_count || 0), 1);
    const barH = H - padT - padB;
    points.forEach((p, i) => {
      const h = ((p.regressed_count || 0) / maxReg) * barH * 0.4;
      const px = x(i);
      bars += `<rect x="${px - 8}" y="${H - padB - h}" width="16" height="${h}" fill="${p.threshold_breached ? '#f85149' : '#8b949e'}" opacity="0.6"/>`;
    });
  }

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grids.join('')}
    ${bars}
    ${baselineLine}
    <path d="${seriesPath}" fill="none" stroke="${normalColor}" stroke-width="2"/>
    ${pointsHtml}
    <text x="${W/2}" y="${H-8}" text-anchor="middle" fill="#8b949e" font-size="11">Run # (oldest → newest)</text>
  </svg>`;
}

async function loadSeries() {
  let baselinePassRate = null;
  try {
    const baseline = await fetchJson('/api/baseline');
    if (baseline && baseline.tasks) {
      const vals = Object.values(baseline.tasks);
      if (vals.length > 0) {
        const passed = vals.filter(t => t.passed).length;
        baselinePassRate = passed / vals.length;
      }
    }
  } catch (e) { /* baseline may not exist */ }
  const data = await fetchJson('/api/series?limit=120');
  renderChart(data.points || [], baselinePassRate);
}

async function renderKPIs() {
  const el = document.getElementById('kpis');
  if (!el) return;
  try {
    const seriesData = await fetchJson('/api/series?limit=5');
    const points = seriesData.points || [];
    let latestPassRate = null;
    let latestRegressed = null;
    let latestBreached = null;
    if (points.length > 0) {
      const last = points[points.length - 1];
      latestPassRate = (last.pass_rate * 100).toFixed(1) + '%';
      latestRegressed = last.regressed_count;
      latestBreached = last.threshold_breached;
    }
    el.innerHTML = `
      <div class="kpi">
        <div class="label">Alias</div>
        <div class="value" style="font-size:1.2rem">${esc(document.getElementById('alias') ? document.getElementById('alias').textContent : '—')}</div>
      </div>
      <div class="kpi">
        <div class="label">Latest pass rate</div>
        <div class="value">${latestPassRate != null ? latestPassRate : '—'}</div>
      </div>
      <div class="kpi">
        <div class="label">Regressed tasks (latest)</div>
        <div class="value">${latestRegressed != null ? latestRegressed : '—'}</div>
      </div>
      <div class="kpi">
        <div class="label">Last run breached?</div>
        <div class="value">${latestBreached != null ? badge(latestBreached ? 'breached' : 'ok') : '—'}</div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = '<div class="kpi"><div class="label">Error</div><div class="value" style="color:var(--bad)">API unavailable</div></div>';
  }
}

async function init() {
  await loadConfig();
  await loadRuns();
  await loadSeries();
  await renderKPIs();

  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true; runBtn.textContent = 'Running...';
      try {
        const res = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        console.log('run result', data);
        await loadRuns();
        await loadSeries();
        await renderKPIs();
      } catch (e) {
        console.error('run failed', e);
        alert('Run failed: ' + e.message);
      } finally {
        runBtn.disabled = false; runBtn.textContent = 'Run suite now';
      }
    });
  }

  const alertBtn = document.getElementById('alert-btn');
  if (alertBtn) {
    alertBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/alerts/test', { method: 'POST' });
        const data = await res.json();
        console.log('test alert', data);
        alert(data.alerted ? 'Test alert sent.' : 'Test alert: ' + (data.reason || 'not sent'));
      } catch (e) {
        alert('Alert test failed: ' + e.message);
      }
    });
  }
}

init().catch(e => console.error('init error', e));