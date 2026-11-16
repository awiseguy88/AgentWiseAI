async function api(path, options) {
  const res = await fetch(path, options);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(JSON.stringify(data) || `HTTP ${res.status}`);
  return data;
}

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(s) {
  return s ? new Date(s).toLocaleString() : '';
}

async function loadPolicy() {
  const p = await api('/api/policy');
  document.getElementById('policy').textContent = JSON.stringify(p, null, 2);
}

async function loadApprovals() {
  const all = document.getElementById('show-all-statuses').checked;
  const status = all ? 'all' : 'pending';
  const rows = await api(`/api/approvals?status=${status}`);
  const tbody = document.querySelector('#approvals-table tbody');
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted">No approvals</td></tr>';
    return;
  }
  for (const r of rows) {
    const tr = document.createElement('tr');
    const args = r.args ? JSON.stringify(JSON.parse(r.args)) : '';
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${esc(r.agent_id)}</td>
      <td>${esc(r.tool)}</td>
      <td>${esc(r.risk_class)}</td>
      <td><code>${esc(args)}</code></td>
      <td>${esc(r.status)}</td>
      <td>${esc(fmtTime(r.created_at))}</td>
      <td>
        ${r.status === 'pending'
          ? `<button class="approve" data-id="${r.id}">Approve</button> <button class="reject" data-id="${r.id}">Reject</button>`
          : `<span class="muted">decided by ${esc(r.decided_by)} at ${esc(fmtTime(r.decided_at))}</span>`}
      </td>`;
    tbody.appendChild(tr);
  }
  document.querySelectorAll('.approve').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const out = await api(`/api/approvals/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      document.getElementById('approvals-msg').textContent = `Approved #${id}: ${JSON.stringify(out)}`;
      await Promise.all([loadApprovals(), loadDecisions(), loadAuditVerify()]);
    };
  });
  document.querySelectorAll('.reject').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id;
      const out = await api(`/api/approvals/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      document.getElementById('approvals-msg').textContent = `Rejected #${id}: ${JSON.stringify(out)}`;
      await Promise.all([loadApprovals(), loadDecisions(), loadAuditVerify()]);
    };
  });
}

async function loadDecisions() {
  const agent = document.getElementById('filter-agent').value.trim();
  const decision = document.getElementById('filter-decision').value;
  let path = '/api/decisions?';
  const params = [];
  if (agent) params.push(`agent_id=${encodeURIComponent(agent)}`);
  if (decision) params.push(`decision=${encodeURIComponent(decision)}`);
  params.push('limit=50');
  path += params.join('&');
  const rows = await api(path);
  const tbody = document.querySelector('#decisions-table tbody');
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">No decisions</td></tr>';
    return;
  }
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${esc(r.agent_id)}</td>
      <td>${esc(r.tool)}</td>
      <td>${esc(r.risk_class)}</td>
      <td><span class="badge badge-${esc(r.decision)}">${esc(r.decision)}</span></td>
      <td>${esc(r.reason)}</td>
      <td>${esc(fmtTime(r.created_at))}</td>`;
    tbody.appendChild(tr);
  }
}

async function loadAuditVerify() {
  const res = await api('/api/audit/verify');
  document.getElementById('verify-result').textContent = JSON.stringify(res, null, 2);
}

document.getElementById('call-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const agentId = form.agentId.value.trim();
  const tool = form.tool.value;
  let args;
  try { args = JSON.parse(form.args.value); } catch { args = {}; }
  try {
    const out = await api(`/api/agents/${encodeURIComponent(agentId)}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, args }),
    });
    document.getElementById('call-result').textContent = JSON.stringify(out, null, 2);
    await Promise.all([loadApprovals(), loadDecisions(), loadAuditVerify()]);
  } catch (err) {
    document.getElementById('call-result').textContent = `Error: ${err.message}`;
  }
});

document.getElementById('refresh-approvals').onclick = loadApprovals;
document.getElementById('refresh-decisions').onclick = loadDecisions;
document.getElementById('verify-audit').onclick = loadAuditVerify;
document.getElementById('show-all-statuses').onchange = loadApprovals;
document.getElementById('filter-agent').onchange = loadDecisions;
document.getElementById('filter-decision').onchange = loadDecisions;

// initial load
Promise.all([loadPolicy(), loadApprovals(), loadDecisions(), loadAuditVerify()]).catch((e) => console.error(e));