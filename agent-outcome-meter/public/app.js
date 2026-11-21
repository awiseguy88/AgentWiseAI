async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function money(v) {
  if (v === null || v === undefined) return '—';
  return '$' + Number(v).toFixed(2);
}

function renderStats(total, merged) {
  document.getElementById('stat-total').textContent = money(total.total_spend_usd);
  document.getElementById('stat-total-events').textContent = total.total_events + ' attributed events';
  document.getElementById('stat-accepted').textContent = money(total.accepted_spend_usd);
  document.getElementById('stat-accepted-hint').textContent = merged.count + ' merged PR' + (merged.count === 1 ? '' : 's');
  document.getElementById('stat-cpo').textContent = money(total.cost_per_accepted_outcome_usd);
  document.getElementById('stat-cpo-hint').textContent = 'Accepted spend / merged PRs';
  document.getElementById('stat-merged').textContent = total.merged_pr_count;
  document.getElementById('stat-failed').textContent = 'Failed (excluded): ' + money(total.failed_spend_usd);
}

function renderMerged(merged) {
  const el = document.getElementById('merged-list');
  if (!merged.pull_requests.length) {
    el.innerHTML = '<p class="empty">No merged pull requests yet.</p>';
    return;
  }
  let html = '';
  for (const pr of merged.pull_requests) {
    html += `<div class="pr-card">
      <div class="pr-head">
        <strong>${pr.repo} #${pr.pr_number}</strong>
        <span class="pr-total">${money(pr.total_cost_usd)} · ${pr.total_events} events</span>
      </div>
      <div class="pr-break">
        <div class="break-col">
          <h4>By model</h4>
          <ul>` +
          Object.entries(pr.by_model).map(([m, v]) => `<li><span class="name">${m}</span><span class="val">${money(v.cost_usd)} (${v.events})</span></li>`).join('') +
        `</ul>
        </div>
        <div class="break-col">
          <h4>By turn</h4>
          <ul>` +
          Object.entries(pr.by_turn).map(([t, v]) => `<li><span class="name">Turn ${t}</span><span class="val">${money(v.cost_usd)} (${v.events})</span></li>`).join('') +
        `</ul>
        </div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

async function renderRuns() {
  const el = document.getElementById('runs-table');
  try {
    const runs = await getJson('/api/dashboard/runs');
    if (!runs.length) { el.innerHTML = '<p class="empty">No runs.</p>'; return; }
    el.innerHTML = `<table class="issues">
      <thead><tr><th>Task</th><th>Repo / PR</th><th>Model</th><th>Turn</th><th>Tokens</th><th>Cost</th><th>Status</th></tr></thead>
      <tbody>` +
      runs.map(r => `<tr>
        <td>${r.task_id}</td>
        <td>${r.repo}${r.pr_number ? ' #' + r.pr_number : ''}</td>
        <td>${r.model}</td>
        <td>${r.turn}</td>
        <td>${r.total_tokens}</td>
        <td>${money(r.cost_usd)}</td>
        <td>${r.accepted ? 'merged' : (r.failed ? 'failed' : 'pending')}</td>
      </tr>`).join('') +
      `</tbody></table>`;
  } catch (e) { el.innerHTML = '<p class="empty">Error loading runs.</p>'; }
}

async function main() {
  try {
    const [total, merged] = await Promise.all([
      getJson('/api/dashboard/total-spend'),
      getJson('/api/dashboard/merged-pr-costs'),
    ]);
    renderStats(total, merged);
    renderMerged(merged);
  } catch (e) {
    document.getElementById('merged-list').innerHTML = '<p class="empty">Error loading data.</p>';
  }
  await renderRuns();
}

main();