async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
function fmt(n){ return (Math.round((n||0)*100)/100).toString(); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const CAT_LABELS = {
  superseded: 'Superseded runs',
  push_pr_duplicate: 'Push + PR duplicates',
  zombie_cron: 'Zombie crons',
  flaky_job: 'Flaky jobs',
  missing_timeout: 'Missing timeouts',
};

function renderCategories(categories) {
  const keys = ['superseded','push_pr_duplicate','zombie_cron','flaky_job','missing_timeout'];
  return `<div class="grid">${keys.map(k=>{
    const c = categories[k] || {recoverable_minutes:0,count:0};
    const mins = typeof c === 'number' ? c : (c.recoverable_minutes||0);
    const count = c.count!=null ? ` <span class="small">(${c.count} findings)</span>` : '';
    return `<div class="stat"><div class="label">${esc(CAT_LABELS[k]||k)}</div><div class="value">${fmt(mins)} min</div><div class="small">recoverable${count}</div></div>`;
  }).join('')}</div>`;
}

async function load() {
  try {
    const dash = await fetchJson('/api/dashboard');
    const summary = document.getElementById('summary-content');
    summary.innerHTML = `
      <p><strong>Total recoverable minutes:</strong> <span class="${dash.total_recoverable_minutes>0?'warn':'ok'}">${fmt(dash.total_recoverable_minutes)}</span></p>
      ${renderCategories(dash.categories)}
    `;

    const reposEl = document.getElementById('repos-content');
    if (!dash.repo_dashboards.length) { reposEl.textContent = 'No repositories.'; }
    else {
      reposEl.innerHTML = dash.repo_dashboards.map(d => {
        const top = d.top_wasteful_workflow ? `<p><strong>Top wasteful workflow:</strong> ${esc(d.top_wasteful_workflow.workflow_name)} (${fmt(d.top_wasteful_workflow.recoverable_minutes)} recoverable min, ${fmt(d.top_wasteful_workflow.total_minutes)} total min)</p>` : `<p><strong>Top wasteful workflow:</strong> <span class="muted">None</span></p>`;
        const badge = d.has_waste ? `<span class="badge waste">waste detected</span>` : `<span class="badge clean">clean</span>`;
        const wfRows = d.workflows.map(w => `<tr><td>${esc(w.workflow_name)}</td><td>${w.runs}</td><td>${fmt(w.total_minutes)}</td><td class="${w.recoverable_minutes>0?'warn':'ok'}">${fmt(w.recoverable_minutes)}</td></tr>`).join('');
        return `<div class="repo" id="repo-${d.repo.id}">
          <h3>${esc(d.repo.full_name)} ${badge}</h3>
          <p class="small">Runs analyzed: ${d.total_runs} · Total recoverable: <strong class="${d.total_recoverable_minutes>0?'warn':'ok'}">${fmt(d.total_recoverable_minutes)} min</strong></p>
          ${top}
          ${renderCategories(d.categories)}
          <table><thead><tr><th>Workflow</th><th>Runs</th><th>Total min</th><th>Recoverable min</th></tr></thead><tbody>${wfRows || '<tr><td colspan="4" class="muted">No workflows</td></tr>'}</tbody></table>
          <div class="actions">
            <button class="secondary" onclick="analyzeRepo(${d.repo.id})">Re-analyze</button>
            <button onclick="remediateRepo(${d.repo.id})">Generate remediation PR</button>
          </div>
          <div id="repo-${d.repo.id}-result" class="small" style="margin-top:8px"></div>
        </div>`;
      }).join('');
    }
    await loadRemediations();
  } catch (e) {
    document.getElementById('summary-content').textContent = 'Error: ' + e.message;
  }
}

async function loadRemediations() {
  try {
    const rems = await fetchJson('/api/remediations');
    const el = document.getElementById('remediation-content');
    if (!rems.length) { el.innerHTML = '<p class="muted">No remediation PRs generated yet.</p>'; return; }
    el.innerHTML = rems.map(r => `<div class="repo">
      <h3>${esc(r.title)} <span class="badge">${esc(r.status)}</span></h3>
      <p class="small">Repo: ${esc(r.repo)} · Category: ${esc(r.category)} · Estimated minutes saved: <strong>${fmt(r.estimated_minutes_saved)}</strong></p>
      ${r.pr_url ? `<p><a href="${esc(r.pr_url)}" target="_blank" rel="noopener">${esc(r.pr_url)}</a></p>`:''}
      ${r.diff ? `<pre>${esc(r.diff)}</pre>`:''}
    </div>`).join('');
  } catch (e) { /* ignore */ }
}

window.analyzeRepo = async function(id) {
  const el = document.getElementById(`repo-${id}-result`);
  el.textContent = 'Analyzing…';
  try { await fetchJson(`/api/repos/${id}/analyze`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); el.textContent = 'Analysis updated.'; await load(); }
  catch(e){ el.textContent = 'Error: ' + e.message; }
};

window.remediateRepo = async function(id) {
  const el = document.getElementById(`repo-${id}-result`);
  el.textContent = 'Generating remediation…';
  try {
    const r = await fetchJson(`/api/repos/${id}/remediate`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({mode:'dry-run'}) });
    if (!r.remediations.length) el.innerHTML = '<span class="ok">No remediation PRs needed (no false-positive actions).</span>';
    else el.innerHTML = `<span class="ok">Created ${r.remediations.length} remediation PR(s). Estimated minutes saved: ${fmt(r.remediations.reduce((s,x)=>s+(x.estimated_minutes_saved||0),0))}.</span>`;
    await loadRemediations();
  } catch(e){ el.textContent = 'Error: ' + e.message; }
};

load();