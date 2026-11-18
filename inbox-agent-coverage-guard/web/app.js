'use strict';

const state = { inbox: 'default', sweeps: [] };

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function renderKPIs(data) {
  document.getElementById('val-processed').textContent = data.processed;
  document.getElementById('val-untouched').textContent = data.untouched;
  document.getElementById('val-failed').textContent = data.failed;
  document.getElementById('val-total').textContent = data.total;
  document.getElementById('inbox-label').textContent = `Inbox: ${data.inbox}` + (data.latest_sweep ? ` · last sweep ${fmtDate(data.latest_sweep.at)}` : '');
}

function renderTrend(sweeps) {
  const container = document.getElementById('trend-chart');
  if (!sweeps.length) { container.innerHTML = '<p class="muted">No sweeps yet. Run a sweep to populate the trend.</p>'; return; }
  const points = sweeps.slice().reverse();
  const W = 640, H = 160, pad = 24;
  const maxV = Math.max(1, ...points.map(p => p.total || 1));
  const step = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  let paths = '';
  const series = [
    { key: 'touched', color: '#2e7d32' },
    { key: 'untouched', color: '#c62828' },
    { key: 'failed', color: '#f9a825' },
  ];
  for (const s of series) {
    const d = points.map((p, i) => {
      const x = pad + i * step;
      const y = H - pad - ((p[s.key] || 0) / maxV) * (H - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" />`;
  }
  let labels = points.map((p, i) => {
    const x = pad + i * step;
    return `<text x="${x.toFixed(1)}" y="${H - 4}" font-size="9" text-anchor="middle">${i + 1}</text>`;
  }).join('');
  container.innerHTML = `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${paths}${labels}</svg>` +
    `<p class="muted">Last ${points.length} sweep(s): green=processed, red=untouched, yellow=failed</p>`;
}

function renderReview(msgs) {
  const list = document.getElementById('review-list');
  const count = document.getElementById('review-count');
  count.textContent = `(${msgs.length})`;
  if (!msgs.length) { list.innerHTML = '<p class="muted">Review queue is empty — every inbox email was touched by an agent.</p>'; return; }
  list.innerHTML = msgs.map(m => `
    <div class="row">
      <div class="row-main">
        <strong>${escapeHtml(m.subject || '(no subject)')}</strong>
        <span class="meta">${escapeHtml(m.from || 'unknown')} · ${fmtDate(m.received_at)}</span>
      </div>
      <div class="row-id">${escapeHtml(m.id)}</div>
    </div>`).join('');
}

function renderDLQ(entries) {
  const list = document.getElementById('dlq-list');
  const count = document.getElementById('dlq-count');
  count.textContent = `(${entries.length})`;
  if (!entries.length) { list.innerHTML = '<p class="muted">Dead-letter queue is empty.</p>'; return; }
  list.innerHTML = entries.map(e => `
    <div class="row">
      <div class="row-main">
        <strong>${escapeHtml(e.action || 'action')} · #${e.id}</strong>
        <span class="meta">msg ${escapeHtml(e.message_id || '—')} · agent ${escapeHtml(e.agent_id || '—')} · attempts ${e.attempts} · status ${e.status}</span>
        <span class="meta">error: ${escapeHtml(e.error && e.error.message || JSON.stringify(e.error || {}))}</span>
      </div>
      <div class="row-actions">
        ${e.status !== 'resolved' ? `<button data-action="retry" data-id="${e.id}">Retry</button>
        <button data-action="resolve" data-id="${e.id}">Resolve</button>` : '<span class="resolved">resolved</span>'}
      </div>
    </div>`).join('');
  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      const endpoint = action === 'retry' ? '/api/dlq/retry' : '/api/dlq/resolve';
      await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      await refreshAll();
    });
  });
}

function renderAudit(entries) {
  const list = document.getElementById('audit-list');
  list.innerHTML = entries.map(a => `
    <div class="row audit-row">
      <span class="meta">${fmtDate(a.at)}</span>
      <span class="badge">${escapeHtml(a.event)}</span>
      <span class="meta">${escapeHtml(a.entity_type || '')} ${escapeHtml(a.entity_id || '')}</span>
    </div>`).join('') || '<p class="muted">No audit events yet.</p>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshAll() {
  const inbox = encodeURIComponent(state.inbox);
  try {
    const dash = await api(`/api/dashboard?inbox=${inbox}`);
    renderKPIs(dash);
    renderTrend(dash.sweeps || []);
    const review = await api(`/api/review?inbox=${inbox}`);
    renderReview(review.untouched || []);
    const dlq = await api(`/api/dlq?inbox=${inbox}`);
    renderDLQ(dlq.dead_letter || []);
    const audit = await api(`/api/audit?inbox=${inbox}`);
    renderAudit(audit.audit || []);
  } catch (e) {
    console.error(e);
  }
}

async function runSweep() {
  const btn = document.getElementById('btn-sweep');
  const status = document.getElementById('sweep-status');
  btn.disabled = true;
  status.textContent = 'Running sweep…';
  try {
    await api('/api/sweep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inbox: state.inbox }) });
    status.textContent = `Sweep done at ${new Date().toLocaleTimeString()}`;
    await refreshAll();
  } catch (e) {
    status.textContent = `Sweep failed: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('btn-sweep').addEventListener('click', runSweep);
document.getElementById('btn-refresh').addEventListener('click', refreshAll);

refreshAll();
setInterval(refreshAll, 15000);