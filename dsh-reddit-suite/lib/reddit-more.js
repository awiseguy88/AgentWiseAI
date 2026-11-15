import { pickAuthMode } from './config.js';
import { summarizeComment } from './reddit-read.js';

function collectMoreNodes(children, postFullname, parentFullname, depth, db, pending) {
  if (!Array.isArray(children)) return;
  for (const ch of children) {
    if (!ch) continue;
    if (ch.kind === 't1' && ch.data) {
      const c = ch.data;
      if (db) db.upsertComment(c, postFullname, depth);
      if (Array.isArray(c.replies?.data?.children)) {
        collectMoreNodes(c.replies.data.children, postFullname, c.name || `t1_${c.id}`, depth + 1, db, pending);
      }
    } else if (ch.kind === 'more' && ch.data) {
      const more = ch.data;
      const childrenIds = Array.isArray(more.children) ? more.children : [];
      if (childrenIds.length > 0) {
        if (db) db.upsertMore(postFullname, parentFullname || postFullname, more, depth, 'pending');
        pending.push({ moreId: more.id || 'more', parentFullname: parentFullname || postFullname, children: childrenIds, count: Number(more.count ?? childrenIds.length), depth });
      }
    }
  }
}

function ingestThings(things, postFullname, parentMapDepth, db) {
  // things from morechildren: array of {kind,data}
  let count = 0;
  const newMore = [];
  for (const th of things || []) {
    if (!th) continue;
    if (th.kind === 't1' && th.data) {
      const c = th.data;
      // infer depth from parent if possible: rough heuristic
      let depth = 0;
      if (c.parent_id && c.parent_id.startsWith('t1_')) {
        const parent = db.db.prepare('SELECT depth FROM comments WHERE fullname=?').get(c.parent_id);
        depth = parent && parent.depth != null ? Number(parent.depth) + 1 : (parentMapDepth.get(c.parent_id) ?? 0) + 1;
      } else {
        depth = 0;
      }
      if (db) db.upsertComment(c, postFullname, depth);
      count++;
      // replies in morechildren responses may be embedded
      if (Array.isArray(c.replies?.data?.children)) {
        collectMoreNodes(c.replies.data.children, postFullname, c.name || `t1_${c.id}`, depth + 1, db, newMore);
      }
    } else if (th.kind === 'more' && th.data) {
      const more = th.data;
      const childrenIds = Array.isArray(more.children) ? more.children : [];
      if (childrenIds.length > 0) {
        newMore.push({ moreId: more.id || 'more', parentFullname: th.data.parent_id || postFullname, children: childrenIds, count: Number(more.count ?? childrenIds.length), depth: 0 });
        if (db) db.upsertMore(postFullname, th.data.parent_id || postFullname, more, 0, 'pending');
      }
    }
  }
  return { count, newMore };
}

export async function expandAllMore(http, db, cfg, { postFullname, initialChildren, linkId, authMode, signal }) {
  authMode = pickAuthMode(cfg, authMode);
  const pending = [];
  // initial pass: store visible comments and collect more nodes
  db.tx(() => collectMoreNodes(initialChildren || [], postFullname, postFullname, 0, db, pending));
  // also load any pending from DB (resume)
  for (const row of db.pendingMore(postFullname)) {
    let kids = [];
    try { kids = JSON.parse(row.children_json || '[]'); } catch { kids = []; }
    if (!pending.find(p => p.moreId === row.more_id && p.parentFullname === row.parent_fullname)) {
      pending.push({ moreId: row.more_id, parentFullname: row.parent_fullname, children: kids, count: row.count, depth: row.depth || 0 });
    }
  }

  let batches = 0;
  let expandedChildren = 0;
  let capped = false;
  let capReason = null;
  const parentDepthCache = new Map();
  const seenKeys = new Set(pending.map(p => `${p.parentFullname}|${p.moreId}|${(p.children||[]).join(',')}`));

  while (pending.length > 0) {
    if (batches >= (cfg.maxMoreBatches || 50)) { capped = true; capReason = 'maxMoreBatches reached'; break; }
    if (expandedChildren >= (cfg.maxMoreChildren || 5000)) { capped = true; capReason = 'maxMoreChildren reached'; break; }
    const node = pending.shift();
    const childrenIds = (node.children || []).slice();
    if (childrenIds.length === 0) {
      db.markMoreStatus(postFullname, node.parentFullname, node.moreId, 'empty');
      continue;
    }
    // batch in chunks of 100 (Reddit typical limit)
    for (let i = 0; i < childrenIds.length; i += 100) {
      if (batches >= (cfg.maxMoreBatches || 50)) { capped = true; capReason = 'maxMoreBatches reached'; break; }
      if (expandedChildren >= (cfg.maxMoreChildren || 5000)) { capped = true; capReason = 'maxMoreChildren reached'; break; }
      const chunk = childrenIds.slice(i, i + 100);
      batches++;
      const form = {
        api_type: 'json',
        children: chunk.join(','),
        link_id: linkId || postFullname,
        raw_json: 1,
      };
      try {
        const res = await http.postForm('/api/morechildren', form, { authMode, signal });
        let things = [];
        if (res.ok && res.json) {
          // shapes: {json:{data:{things:[...]}}} or {json:{errors:[...]}}
          things = res.json?.json?.data?.things || res.json?.data?.things || [];
          const errs = res.json?.json?.errors;
          if ((!things || things.length === 0) && errs && errs.length) {
            // mark partial but continue
            db.markMoreStatus(postFullname, node.parentFullname, node.moreId, 'error');
          }
        } else if (!res.ok) {
          db.markMoreStatus(postFullname, node.parentFullname, node.moreId, `http_${res.status}`);
          // continue to try other chunks/nodes
          continue;
        } else {
          // non-json
          db.markMoreStatus(postFullname, node.parentFullname, node.moreId, 'non_json');
          continue;
        }
        const { count, newMore } = db.tx(() => ingestThings(things, postFullname, parentDepthCache, db));
        expandedChildren += count;
        for (const nm of newMore) {
          const key = `${nm.parentFullname}|${nm.moreId}|${(nm.children||[]).join(',')}`;
          if (!seenKeys.has(key) && (nm.children||[]).length) { seenKeys.add(key); pending.push(nm); }
        }
      } catch (e) {
        db.markMoreStatus(postFullname, node.parentFullname, node.moreId, 'exception');
        // keep going with other nodes
      }
    }
    // if processed all chunks for node, mark expanded unless chunks errored individually
    const row = db.db.prepare('SELECT status FROM more_nodes WHERE key=?').get(`${postFullname}|${node.parentFullname}|${node.moreId}`);
    if (row && row.status === 'pending') db.markMoreStatus(postFullname, node.parentFullname, node.moreId, capped ? 'partial' : 'expanded');
    if (capped) break;
  }

  if (capped) {
    // mark remaining as capped/pending
    for (const node of pending) db.markMoreStatus(postFullname, node.parentFullname, node.moreId, 'capped');
  }

  const remaining = db.pendingMore(postFullname).length;
  return { ok: true, postFullname, batches, expandedChildren, remaining, capped, capReason, complete: !capped && remaining === 0 };
}
