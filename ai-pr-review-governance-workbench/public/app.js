async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`);
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function loadConfig() {
  try {
    const cfg = await fetchJson('/api/config');
    document.getElementById('config').innerHTML =
      `<span class="chip">Max lines <b>${cfg.maxLines}</b></span>` +
      `<span class="chip">Max files <b>${cfg.maxFiles}</b></span>` +
      `<span class="chip">Webhook secret <b>${cfg.webhookSecretConfigured ? 'set' : 'not set'}</b></span>` +
      `<span class="chip">GitHub token <b>${cfg.githubTokenConfigured ? 'set' : 'mock'}</b></span>`;
  } catch (e) { console.error(e); }
}

async function loadSprawl() {
  const list = document.getElementById('sprawl-list');
  list.innerHTML = '';
  try {
    const items = await fetchJson('/api/sprawl');
    const sprawl = items.filter(i => i.status === 'sprawl' || i.status === 'rescope');
    if (sprawl.length === 0) {
      list.innerHTML = '<div class="empty">No oversized PRs flagged. Reviewer proceeds normally.</div>';
      return;
    }
    const template = document.getElementById('sprawl-row-template');
    for (const item of sprawl) {
      const row = template.content.firstElementChild.cloneNode(true);
      row.dataset.id = item.id;
      const repo = row.querySelector('.repo');
      repo.textContent = item.repo;
      repo.href = item.html_url || '#';
      row.querySelector('.pr-number').textContent = item.pr_number;
      row.querySelector('.title').textContent = item.title;
      row.querySelector('.author-name').textContent = item.author;
      row.querySelector('.lines').textContent = item.lines;
      row.querySelector('.files').textContent = item.files;
      const status = row.querySelector('.status');
      status.textContent = item.status;
      status.className = 'stat status ' + item.status;
      const btn = row.querySelector('.rescope');
      if (item.status === 'rescope') {
        btn.textContent = 'Sent back to rescope';
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => rescope(item.id));
      }
      list.appendChild(row);
    }
  } catch (e) {
    list.innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

async function rescope(id) {
  try {
    const btn = document.querySelector(`[data-id="${id}"] .rescope`);
    btn.disabled = true;
    await fetchJson(`/api/sprawl/${id}/rescope`, { method: 'POST' });
    toast('Sent back to rescope: comment posted and needs-rescope label applied');
    await loadSprawl();
  } catch (e) {
    toast(e.message);
    const btn = document.querySelector(`[data-id="${id}"] .rescope`);
    if (btn) btn.disabled = false;
  }
}

async function loadLog() {
  const logEl = document.getElementById('webhook-log');
  try {
    const logs = await fetchJson('/api/webhook-log');
    if (!logs.length) {
      logEl.innerHTML = '<div class="empty">No webhook activity yet.</div>';
      return;
    }
    logEl.innerHTML = logs.slice(0, 20).map(l => `
      <div class="log-row">
        <span>${l.created_at}</span>
        <span>${l.event || 'webhook'}</span>
        <span>${l.repo || ''}</span>
        ${l.pr_number ? `<span>PR #${l.pr_number}</span>` : ''}
        <span class="${l.signature_valid ? 'ok' : 'bad'}">${l.signature_valid ? 'signature ok' : 'signature rejected'}</span>
        ${l.error ? `<span class="err">${l.error}</span>` : ''}
      </div>
    `).join('');
  } catch (e) { logEl.innerHTML = `<div class="empty">${e.message}</div>`; }
}

async function refresh() {
  await Promise.all([loadConfig(), loadSprawl(), loadLog()]);
}

document.getElementById('refresh').addEventListener('click', refresh);
refresh();
setInterval(refresh, 5000);