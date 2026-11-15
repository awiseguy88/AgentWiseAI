import { pickAuthMode, requireWriteAccess } from './config.js';

function okOrThrow(res, action) {
  if (res.ok && res.json) return res.json;
  if (!res.ok) {
    const msg = res.json?.message || res.json?.error || res.json?.reason || res.statusText || 'request failed';
    const err = new Error(`${action} failed: HTTP ${res.status} ${msg}`.trim());
    err.status = res.status; err.body = res.json || res.text?.slice(0, 300);
    throw err;
  }
  return res.json || { ok: true };
}

export async function submitPost(http, db, cfg, args = {}) {
  requireWriteAccess(cfg, args);
  const authMode = pickAuthMode(cfg, args.authMode);
  const form = {
    api_type: 'json',
    sr: args.subreddit?.replace(/^r\//i,''),
    kind: args.kind || 'self',
    title: args.title,
    sendreplies: args.sendReplies !== false,
    resubmit: !!args.resubmit,
    extension: 'json',
  };
  if (!form.sr) throw new Error('subreddit is required');
  if (!form.title) throw new Error('title is required');
  if (form.kind === 'self') form.text = args.text || args.selftext || '';
  else if (form.kind === 'link') form.url = args.url;
  if (args.nsfw) form.nsfw = true;
  if (args.spoiler) form.spoiler = true;
  if (args.flair_id) form.flair_id = args.flair_id;
  if (args.flair_text) form.flair_text = args.flair_text;
  if (args.dryRun) {
    db.auditAction({ action: 'submit_post', target: `r/${form.sr}`, params: { kind: form.kind, title: form.title, dryRun: true }, authMode, dryRun: true, confirmed: true, status: 'dry_run' });
    return { ok: true, dryRun: true, action: 'submit_post', request: { subreddit: form.sr, kind: form.kind, title: form.title } };
  }
  const res = await http.postForm('/api/submit', form, { authMode });
  const json = okOrThrow(res, 'submit_post');
  const errors = json.json?.errors || [];
  if (errors.length) throw new Error(`submit_post failed: ${errors.map(e => Array.isArray(e)?e.join(': '):String(e)).join('; ')}`);
  const data = json.json?.data || {};
  db.auditAction({ action: 'submit_post', target: `r/${form.sr}`, params: { kind: form.kind, title: form.title }, authMode, dryRun: false, confirmed: true, status: 'ok', httpStatus: res.status, responseId: data.name || data.id || null });
  return { ok: true, action: 'submit_post', id: data.id, name: data.name, url: data.url };
}

export async function submitComment(http, db, cfg, args = {}) {
  requireWriteAccess(cfg, args);
  const authMode = pickAuthMode(cfg, args.authMode);
  const thingId = args.thingId || args.parent;
  const text = args.text || args.body;
  if (!thingId) throw new Error('thingId (post/comment fullname, e.g. t3_xxx or t1_xxx) is required');
  if (!text) throw new Error('text is required');
  if (args.dryRun) {
    db.auditAction({ action: 'submit_comment', target: thingId, params: { dryRun: true }, authMode, dryRun: true, confirmed: true, status: 'dry_run' });
    return { ok: true, dryRun: true, action: 'submit_comment', request: { thingId, textPreview: String(text).slice(0,120) } };
  }
  const res = await http.postForm('/api/comment', { api_type: 'json', thing_id: thingId, text }, { authMode });
  const json = okOrThrow(res, 'submit_comment');
  const errors = json.json?.errors || [];
  if (errors.length) throw new Error(`submit_comment failed: ${errors.map(e => Array.isArray(e)?e.join(': '):String(e)).join('; ')}`);
  const things = json.json?.data?.things || [];
  const created = things[0]?.data;
  db.auditAction({ action: 'submit_comment', target: thingId, params: {}, authMode, dryRun: false, confirmed: true, status: 'ok', httpStatus: res.status, responseId: created?.name || null });
  return { ok: true, action: 'submit_comment', thingId, created: created ? { name: created.name, id: created.id, permalink: created.permalink } : null };
}

export async function editThing(http, db, cfg, args = {}) {
  requireWriteAccess(cfg, args);
  const authMode = pickAuthMode(cfg, args.authMode);
  const thingId = args.thingId;
  const text = args.text;
  if (!thingId || !text) throw new Error('thingId and text are required');
  if (args.dryRun) { db.auditAction({ action: 'edit', target: thingId, params: { dryRun: true }, authMode, dryRun: true, confirmed: true, status: 'dry_run' }); return { ok: true, dryRun: true, action: 'edit', thingId }; }
  const res = await http.postForm('/api/editusertext', { api_type: 'json', thing_id: thingId, text }, { authMode });
  const json = okOrThrow(res, 'edit');
  const errors = json.json?.errors || [];
  if (errors.length) throw new Error(`edit failed: ${errors.map(e => Array.isArray(e)?e.join(': '):String(e)).join('; ')}`);
  db.auditAction({ action: 'edit', target: thingId, params: {}, authMode, dryRun: false, confirmed: true, status: 'ok', httpStatus: res.status, responseId: thingId });
  return { ok: true, action: 'edit', thingId };
}

export async function deleteThing(http, db, cfg, args = {}) {
  requireWriteAccess(cfg, args);
  const authMode = pickAuthMode(cfg, args.authMode);
  const thingId = args.thingId || args.id;
  if (!thingId) throw new Error('thingId is required');
  if (args.dryRun) { db.auditAction({ action: 'delete', target: thingId, params: { dryRun: true }, authMode, dryRun: true, confirmed: true, status: 'dry_run' }); return { ok: true, dryRun: true, action: 'delete', thingId }; }
  const res = await http.postForm('/api/del', { id: thingId }, { authMode });
  if (!res.ok) { const msg = res.json?.message || res.statusText; throw new Error(`delete failed: HTTP ${res.status} ${msg}`); }
  db.auditAction({ action: 'delete', target: thingId, params: {}, authMode, dryRun: false, confirmed: true, status: 'ok', httpStatus: res.status, responseId: thingId });
  return { ok: true, action: 'delete', thingId };
}

export async function vote(http, db, cfg, args = {}) {
  requireWriteAccess(cfg, args);
  const authMode = pickAuthMode(cfg, args.authMode);
  const thingId = args.thingId || args.id;
  const dir = Number(args.dir);
  if (!thingId) throw new Error('thingId is required');
  if (![1,0,-1].includes(dir)) throw new Error('dir must be 1 (up), 0 (clear), or -1 (down)');
  if (args.dryRun) { db.auditAction({ action: 'vote', target: thingId, params: { dir, dryRun: true }, authMode, dryRun: true, confirmed: true, status: 'dry_run' }); return { ok: true, dryRun: true, action: 'vote', thingId, dir }; }
  const res = await http.postForm('/api/vote', { id: thingId, dir }, { authMode });
  if (!res.ok) { const msg = res.json?.message || res.statusText; throw new Error(`vote failed: HTTP ${res.status} ${msg}`); }
  db.auditAction({ action: 'vote', target: thingId, params: { dir }, authMode, dryRun: false, confirmed: true, status: 'ok', httpStatus: res.status, responseId: thingId });
  return { ok: true, action: 'vote', thingId, dir };
}

export async function modAction(http, db, cfg, args = {}) {
  requireWriteAccess(cfg, args);
  const authMode = pickAuthMode(cfg, args.authMode);
  const action = String(args.action || '').toLowerCase();
  if (!action) throw new Error('action is required');
  const id = args.thingId || args.id;
  const sr = args.subreddit?.replace(/^r\//i,'');
  if (args.dryRun) { db.auditAction({ action: `mod:${action}`, target: id || sr || action, params: { ...args, dryRun: true }, authMode, dryRun: true, confirmed: true, status: 'dry_run' }); return { ok: true, dryRun: true, action: `mod:${action}`, request: { id, subreddit: sr } }; }
  let path, form = { api_type: 'json' };
  switch (action) {
    case 'approve': path = '/api/approve'; form.id = id; break;
    case 'remove': path = '/api/remove'; form.id = id; form.spam = !!args.spam; break;
    case 'spam': path = '/api/remove'; form.id = id; form.spam = true; break;
    case 'distinguish': path = '/api/distinguish'; form.id = id; form.how = args.how || 'yes'; if (args.sticky) form.sticky = true; break;
    case 'lock': path = '/api/lock'; form.id = id; break;
    case 'unlock': path = '/api/unlock'; form.id = id; break;
    case 'sticky': path = '/api/set_subreddit_sticky'; form.id = id; form.state = args.state !== false; if (args.num != null) form.num = args.num; break;
    case 'ignore_reports': path = '/api/ignore_reports'; form.id = id; break;
    case 'unignore_reports': path = '/api/unignore_reports'; form.id = id; break;
    default:
      // generic pass-through for advanced actions
      if (args.path) { path = args.path; form = { ...form, ...(args.form||{}) }; }
      else throw new Error(`Unsupported mod action: ${action}. Supported: approve, remove, spam, distinguish, lock, unlock, sticky, ignore_reports, unignore_reports (or provide args.path+args.form for pass-through).`);
  }
  if (!path) throw new Error('Unable to resolve moderation endpoint');
  const res = await http.postForm(path, form, { authMode });
  if (!res.ok) {
    const msg = res.json?.message || res.json?.error || res.statusText;
    db.auditAction({ action: `mod:${action}`, target: id || sr || path, params: form, authMode, dryRun: false, confirmed: true, status: 'error', httpStatus: res.status, error: msg });
    throw new Error(`mod action ${action} failed: HTTP ${res.status} ${msg}`);
  }
  db.auditAction({ action: `mod:${action}`, target: id || sr || path, params: form, authMode, dryRun: false, confirmed: true, status: 'ok', httpStatus: res.status, responseId: id || null });
  return { ok: true, action: `mod:${action}`, target: id || sr || null, status: res.status };
}
