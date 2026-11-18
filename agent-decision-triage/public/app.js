async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error((data && (data.message || data.error)) || text || res.statusText);
  return data;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function parseResponse(text) {
  const t = text.trim();
  if (!t) return '';
  try { return JSON.parse(t); } catch { return t; }
}

function renderContext(ctx) {
  let out = `<div><strong>Summary:</strong> ${esc(ctx.summary)}</div>`;
  if (ctx.agent || ctx.session) out += `<div class="meta">agent: ${esc(ctx.agent||'')} session: ${esc(ctx.session||'')}</div>`;
  if (ctx.prompt) out += `<div><strong>Prompt:</strong> ${esc(ctx.prompt)}</div>`;
  if (Array.isArray(ctx.links) && ctx.links.length) {
    out += '<div><strong>Links:</strong><ul>' + ctx.links.map(l => `<li><a href="${esc(l.url)}" target="_blank">${esc(l.label||l.url)}</a>${l.snippet?` <span class="meta">— ${esc(l.snippet)}</span>`:''}</li>`).join('') + '</ul></div>';
  }
  if (ctx.diff) {
    const d = ctx.diff;
    out += `<div><strong>Diff:</strong> ${esc(d.path||'')}<pre>${esc((d.hunks||[]).join('\n') || d.after || '')}</pre></div>`;
  }
  return out;
}

function itemCard(item) {
  const dups = item.duplicates || [];
  const dupHtml = dups.length ? `<div class="duplicates"><strong>Linked duplicates (${dups.length}):</strong><ul>${dups.map(d=>`<li>#${d.id} session <code>${esc(d.session||'')}</code> (${esc(d.status)}) — ${esc(d.context && d.context.summary || '')}</li>`).join('')}</ul><div class="meta">Resolving this item delivers the same response to each linked waiting caller.</div></div>` : '';
  const resolvedInfo = item.status === 'resolved' ? `<div class="meta">Resolved by <strong>${esc(item.resolvedBy||'')}</strong> at ${esc(item.resolvedAt||'')} · delivery attempts: ${item.deliveryAttempts}${item.deliveryError?` · <span class="error">${esc(item.deliveryError)}</span>`:''}</div>` : '';
  const responseField = ['pending','snoozed','needs-info'].includes(item.status) ? `
    <div class="actions">
      <label class="inline"><input type="checkbox" class="batch-check" data-id="${item.id}" checked> include in batch</label>
    </div>
    <div><label>Response (JSON or text)<textarea class="response-input" data-id="${item.id}" placeholder='e.g. {"decision":"approve"} or plain text'></textarea></label></div>
    <div class="actions">
      <button class="small" data-action="snooze" data-id="${item.id}">Snooze</button>
      <button class="small" data-action="needs-info" data-id="${item.id}">Needs info</button>
    </div>` : `<div><strong>Response:</strong><pre>${esc(JSON.stringify(item.response, null, 2))}</pre></div>`;
  return `<div class="item" data-item-id="${item.id}">
    <div class="item-header">
      <span class="num">${item.queueNumber ? '#' + item.queueNumber : '—'}</span>
      <span class="badge type-${esc(item.type)}">${esc(item.type)}</span>
      <span class="badge status-${esc(item.status)}">${esc(item.status)}</span>
      <span class="meta">item ${item.id} · session ${esc(item.session||'n/a')} · priority ${item.priority}</span>
    </div>
    <div class="summary">${esc(item.summary)}</div>
    <div class="context">${renderContext(item.context || {})}</div>
    ${dupHtml}
    ${resolvedInfo}
    ${responseField}
  </div>`;
}

async function refresh() {
  const status = document.getElementById('statusMsg');
  try {
    const data = await api('/api/inbox');
    const items = data.items || [];
    const active = items.filter(i => ['pending','snoozed','needs-info'].includes(i.status) && !i.isDuplicate);
    const done = items.filter(i => ['resolved','failed'].includes(i.status));
    document.getElementById('inbox').innerHTML = active.length ? active.map(itemCard).join('') : '<div class="empty">No pending decisions.</div>';
    document.getElementById('history').innerHTML = done.length ? `<table><thead><tr><th>#</th><th>ID</th><th>Type</th><th>Status</th><th>Session</th><th>Summary</th><th>Responder</th><th>Resolved</th></tr></thead><tbody>${done.map(i=>`<tr><td>${i.queueNumber||''}</td><td>${i.id}</td><td>${esc(i.type)}</td><td>${esc(i.status)}</td><td>${esc(i.session||'')}</td><td>${esc(i.summary)}</td><td>${esc(i.resolvedBy||'')}</td><td>${esc(i.resolvedAt||'')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No completed items yet.</div>';
    wireActions();
    status.textContent = `Loaded ${items.length} item(s).`;
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
}

function wireActions() {
  document.querySelectorAll('[data-action="snooze"]').forEach(btn => btn.onclick = async () => {
    const id = Number(btn.dataset.id);
    await api(`/api/items/${id}/snooze`, { method: 'POST', body: JSON.stringify({ reason: 'operator snooze' }) });
    refresh();
  });
  document.querySelectorAll('[data-action="needs-info"]').forEach(btn => btn.onclick = async () => {
    const id = Number(btn.dataset.id);
    const q = prompt('What info is needed?');
    if (!q) return;
    await api(`/api/items/${id}/needs-info`, { method: 'POST', body: JSON.stringify({ question: q }) });
    refresh();
  });
}

document.getElementById('refreshBtn').onclick = refresh;
document.getElementById('resolveBatchBtn').onclick = async () => {
  const responder = document.getElementById('responderName').value || 'operator';
  const checks = Array.from(document.querySelectorAll('.batch-check:checked'));
  if (!checks.length) { alert('Select at least one item.'); return; }
  const resolutions = [];
  for (const cb of checks) {
    const id = Number(cb.dataset.id);
    const ta = document.querySelector(`.response-input[data-id="${id}"]`);
    const response = parseResponse(ta ? ta.value : '');
    resolutions.push({ id, response, responder });
  }
  const status = document.getElementById('statusMsg');
  try {
    const result = await api('/api/batch/resolve', { method: 'POST', body: JSON.stringify({ resolutions }) });
    status.textContent = 'Batch resolved: ' + JSON.stringify(result.results);
    await refresh();
  } catch (e) {
    status.textContent = 'Batch error: ' + e.message;
  }
};

refresh();
setInterval(refresh, 5000);