const API = '/api';
let currentAppId = null;

const els = {
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userBadge: document.getElementById('userBadge'),
  addAppBtn: document.getElementById('addAppBtn'),
  releaseBtn: document.getElementById('releaseBtn'),
  ownerChangeBtn: document.getElementById('ownerChangeBtn'),
  backBtn: document.getElementById('backBtn'),
  detailSection: document.getElementById('detailSection'),
  appsTable: document.getElementById('appsTable'),
  appsTbody: document.querySelector('#appsTable tbody'),
  appEmpty: document.getElementById('appEmpty'),
  detailTitle: document.getElementById('detailTitle'),
  detailMeta: document.getElementById('detailMeta'),
  checklistBox: document.getElementById('checklistBox'),
  releasesTable: document.getElementById('releasesTable'),
  releasesTbody: document.querySelector('#releasesTable tbody'),
  relModal: document.getElementById('releaseModal'),
  relVersion: document.getElementById('relVersion'),
  relScope: document.getElementById('relScope'),
  relSubmit: document.getElementById('relSubmit'),
  relCancel: document.getElementById('relCancel'),
  relMsg: document.getElementById('relMsg'),
  ownModal: document.getElementById('ownerModal'),
  newOwner: document.getElementById('newOwner'),
  ownSubmit: document.getElementById('ownSubmit'),
  ownCancel: document.getElementById('ownCancel'),
  ownMsg: document.getElementById('ownMsg'),
  loginModal: document.getElementById('loginModal'),
  loginUser: document.getElementById('loginUser'),
  loginPass: document.getElementById('loginPass'),
  loginSubmit: document.getElementById('loginSubmit'),
  loginCancel: document.getElementById('loginCancel'),
  loginMsg: document.getElementById('loginMsg'),
  auditTable: document.querySelector('#auditTable tbody'),
};

function showEl(el) { el.style.display = ''; }
function hideEl(el) { el.style.display = 'none'; }
function msg(el, text, err = false) { el.textContent = text; el.style.color = err ? '#dc2626' : '#166534'; }

async function fetchJSON(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(API + path, { ...opts, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || res.statusText);
  return body;
}

async function loadMe() {
  try {
    const me = await fetchJSON('/me');
    els.userBadge.textContent = `Signed in as ${me.username} (${me.role})`;
    showEl(els.logoutBtn);
    hideEl(els.loginBtn);
    if (me.role === 'admin') {
      showEl(els.addAppBtn);
    }
  } catch (e) {
    hideEl(els.logoutBtn);
    showEl(els.loginBtn);
  }
}

async function loadApps() {
  const apps = await fetchJSON('/apps');
  if (!apps.length) { els.appEmpty.textContent = 'No apps registered yet.'; return; }
  hideEl(els.appEmpty);
  showEl(els.appsTable);
  els.appsTbody.innerHTML = '';
  for (const a of apps) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" onclick="openApp(${a.id}, '${escapeHtml(a.name)}')">${escapeHtml(a.name)}</a></td>
      <td>${escapeHtml(a.owner_name || '')}</td>
      <td>${escapeHtml(a.audience)}</td>
      <td>${escapeHtml(a.data_scope)}</td>
      <td>${escapeHtml(a.current_release_id ? 'live' : 'none')}</td>
      <td>${a.status}</td>
    `;
    els.appsTbody.appendChild(tr);
  }
}

async function openApp(id, name) {
  currentAppId = id;
  const app = await fetchJSON(`/apps/${id}`);
  els.detailTitle.textContent = name;
  els.detailMeta.textContent = `Owner: ${escapeHtml(app.owner_name || '')} · Reviewer: ${escapeHtml(app.reviewer_name || 'none')} · Audience: ${escapeHtml(app.audience)} · Data scope: ${escapeHtml(app.data_scope)} · Status: ${app.status}`;

  // checklist
  const cl = await fetchJSON(`/apps/${id}/checklist`);
  let html = `<p>Governance checklist: ${cl.blocked ? '<strong>BLOCKED — launch not allowed</strong>' : '<strong>Cleared — launch allowed</strong>'}</p>`;
  html += `<ul>
<li>Owner confirmed data scope: ${cl.owner_confirmed ? 'Yes' : 'No'}</li>
<li>Reviewer signed off: ${cl.reviewer_signed_off ? 'Yes' : 'No'}</li>
</ul>`;
  const me = await fetchJSON('/me');
  if (me.role === 'admin' || app.owner_id === me.id) {
    html += `<button id="btnConfirmChecklist">Confirm I have reviewed the data scope</button>`;
  }
  if (me.role === 'reviewer' || me.role === 'admin') {
    html += `<button id="btnSignoffChecklist">Reviewer sign-off</button>`;
  }
  els.checklistBox.innerHTML = html;
  const btnConfirm = document.getElementById('btnConfirmChecklist');
  if (btnConfirm) btnConfirm.onclick = () => confirmChecklist();
  const btnSignoff = document.getElementById('btnSignoffChecklist');
  if (btnSignoff) btnSignoff.onclick = () => signoffChecklist();

  loadReleases(id);

  showEl(els.detailSection);
  hideEl(els.appsTable);
  hideEl(els.addAppBtn);
  els.backBtn.style.display = '';
  els.releaseBtn.style.display = '';
  els.ownerChangeBtn.style.display = (me.role === 'admin') ? '' : 'none';
}

async function loadReleases(id) {
  const releases = await fetchJSON(`/apps/${id}/releases`);
  els.releasesTbody.innerHTML = '';
  if (!releases.length) { hideEl(els.releasesTable); return; }
  showEl(els.releasesTable);
  for (const r of releases) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.version)}</td>
      <td>${escapeHtml(r.data_scope)}</td>
      <td><strong>${r.status}</strong></td>
      <td>${escapeHtml(r.submitted_by_name || r.submitted_by)}</td>
      <td>
        ${r.status === 'pending' ? `<button onclick="handleRelease(${r.id}, 'approve')">Approve</button> <button onclick="handleRelease(${r.id}, 'reject')">Reject</button>` : ''}
      </td>
    `;
    els.releasesTbody.appendChild(tr);
  }
}

async function handleRelease(id, action) {
  try {
    await fetchJSON(`/releases/${id}/${action}`, { method: 'POST' });
    await loadReleases(currentAppId);
    await openApp(currentAppId, els.detailTitle.textContent);
  } catch (e) { alert(e.message); }
}

async function submitRelease() {
  const version = els.relVersion.value.trim();
  const scope = els.relScope.value.trim();
  if (!version || !scope) { msg(els.relMsg, 'Version and scope required', true); return; }
  try {
    await fetchJSON(`/apps/${currentAppId}/releases`, { method: 'POST', body: JSON.stringify({ version, data_scope: scope }) });
    closeRelModal();
    await loadReleases(currentAppId);
  } catch (e) { msg(els.relMsg, e.message, true); }
}

async function changeOwnership() {
  const ownerId = els.newOwner.value;
  try {
    await fetchJSON(`/apps/${currentAppId}/owner`, { method: 'PUT', body: JSON.stringify({ owner_id: Number(ownerId) }) });
    closeOwnModal();
    await loadApps();
    await openApp(currentAppId, els.detailTitle.textContent);
  } catch (e) { msg(els.ownMsg, e.message, true); }
}

async function confirmChecklist() {
  try {
    await fetchJSON(`/apps/${currentAppId}/checklist/confirm`, { method: 'POST' });
    await openApp(currentAppId, els.detailTitle.textContent);
  } catch (e) { alert(e.message); }
}

async function signoffChecklist() {
  try {
    await fetchJSON(`/apps/${currentAppId}/checklist/signoff`, { method: 'POST' });
    await openApp(currentAppId, els.detailTitle.textContent);
  } catch (e) { alert(e.message); }
}

function openRelModal() { showEl(els.relModal); els.relMsg.textContent = ''; }
function closeRelModal() { hideEl(els.relModal); }
function openOwnModal() {
  fetchJSON('/users').then(users => {
    els.newOwner.innerHTML = users.map(u => `<option value="${u.id}">${escapeHtml(u.username)} (${u.role})</option>`).join('');
  });
  showEl(els.ownModal); els.ownMsg.textContent = '';
}
function closeOwnModal() { hideEl(els.ownModal); }
function openLogin() { showEl(els.loginModal); els.loginMsg.textContent = ''; }
function closeLogin() { hideEl(els.loginModal); }

async function doLogin() {
  try {
    await fetchJSON('/login', { method: 'POST', body: JSON.stringify({ username: els.loginUser.value, password: els.loginPass.value }) });
    closeLogin();
    await loadMe();
    await loadApps();
  } catch (e) { msg(els.loginMsg, e.message, true); }
}

async function doLogout() {
  await fetchJSON('/logout', { method: 'POST' });
  location.reload();
}

async function loadAudit() {
  const logs = await fetchJSON('/audit');
  els.auditTable.innerHTML = logs.map(l => `<tr><td>${l.created_at}</td><td>${escapeHtml(l.username || 'system')}</td><td>${l.action}</td><td>${l.target_type} #${l.target_id}</td><td>${escapeHtml(l.details || '')}</td></tr>`).join('');
}

window.openApp = openApp;
window.handleRelease = handleRelease;

els.loginBtn.onclick = openLogin;
els.logoutBtn.onclick = doLogout;
els.loginSubmit.onclick = doLogin;
els.loginCancel.onclick = closeLogin;
els.addAppBtn.onclick = () => {
  const name = prompt('App name');
  const audience = prompt('Intended audience');
  const scope = prompt('Data access scope');
  if (name && audience && scope) {
    fetchJSON('/apps', { method: 'POST', body: JSON.stringify({ name, audience, data_scope: scope }) })
      .then(() => { loadApps(); openApp(undefined, name); })
      .catch(e => alert(e.message));
  }
};
els.backBtn.onclick = () => { hideEl(els.detailSection); showEl(els.appsTable); showEl(els.addAppBtn); currentAppId = null; };
els.releaseBtn.onclick = openRelModal;
els.relCancel.onclick = closeRelModal;
els.relSubmit.onclick = submitRelease;
els.ownerChangeBtn.onclick = openOwnModal;
els.ownCancel.onclick = closeOwnModal;
els.ownSubmit.onclick = changeOwnership;

loadMe();
loadApps();
loadAudit();