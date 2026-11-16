import { pickAuthMode } from './config.js';

function ensureDotJson(path) {
  if (/\.json($|\?)/.test(path)) return path;
  return path.endsWith('/') ? `${path}.json` : `${path}.json`;
}

function fullnameFromPermalink(permalink) {
  // /r/sub/comments/<id>/<slug>/...
  const m = String(permalink || '').match(/\/comments\/([a-z0-9]+)/i);
  return m ? `t3_${m[1]}` : null;
}

export function normalizePostTarget(post) {
  if (!post) throw new Error('Missing post identifier (id, fullname, or permalink/url).');
  let s = String(post).trim();
  if (!s) throw new Error('Empty post identifier.');
  // URL/permalink
  if (/^https?:\/\//i.test(s) || s.startsWith('/r/') || s.includes('/comments/')) {
    const id = fullnameFromPermalink(s);
    if (id) return { kind: 'permalink', id, path: s.replace(/^https?:\/\/[^/]+/i, '') };
  }
  if (s.startsWith('t3_')) return { kind: 'fullname', id: s, shortId: s.slice(3) };
  s = s.replace(/^t1_/, '');
  if (/^[a-z0-9]+$/i.test(s)) return { kind: 'id', id: `t3_${s}`, shortId: s };
  return { kind: 'unknown', id: s };
}

export async function browseSubreddit(http, db, cfg, params = {}) {
  const subreddit = String(params.subreddit || '').replace(/^r\//i, '').trim();
  if (!subreddit) throw new Error('subreddit is required');
  const sort = ['hot','new','top','rising','controversial'].includes(params.sort) ? params.sort : 'hot';
  const limit = Math.min(Math.max(Number(params.limit) || 25, 1), cfg.maxItemsPerCall || 100);
  const query = { limit, raw_json: 1 };
  if (params.after) query.after = params.after;
  if (params.before) query.before = params.before;
  if (params.t && sort === 'top' || params.t && sort === 'controversial') query.t = params.t; // hour,day,week,month,year,all
  const path = `/r/${encodeURIComponent(subreddit)}/${sort}.json`;
  const authMode = pickAuthMode(cfg, params.authMode);
  const startedAt = new Date().toISOString();
  let items = 0;
  try {
    const res = await http.getJson(path, { query, authMode, signal: params.signal });
    const listing = res.json?.data || res.json || {};
    const children = Array.isArray(listing.children) ? listing.children : [];
    const fetchedAt = new Date().toISOString();
    const out = [];
    if (params.store !== false) {
      db.tx(() => {
        for (const ch of children) {
          if (ch?.kind === 't3' && ch.data) {
            db.upsertPost(ch.data, authMode, fetchedAt);
            out.push(summarizePost(ch.data));
            items++;
          } else if (ch?.kind === 't5' && ch.data) {
            db.upsertSubreddit(ch.data, fetchedAt);
          }
        }
      });
    } else {
      for (const ch of children) if (ch?.kind === 't3' && ch.data) { out.push(summarizePost(ch.data)); items++; }
    }
    db.auditFetch({ kind: 'browse_subreddit', target: `r/${subreddit}/${sort}`, params: { ...query }, authMode, status: 'ok', httpStatus: res.status, items, startedAt, finishedAt: fetchedAt });
    return { ok: true, subreddit, sort, authMode, count: items, after: listing.after || null, before: listing.before || null, posts: out };
  } catch (e) {
    db.auditFetch({ kind: 'browse_subreddit', target: `r/${subreddit}/${sort}`, params, authMode, status: 'error', error: e.message, startedAt, finishedAt: new Date().toISOString() });
    throw e;
  }
}

export function summarizePost(p) {
  return {
    fullname: p.name || (p.id ? `t3_${p.id}` : null),
    id: p.id,
    subreddit: p.subreddit,
    author: p.author,
    title: p.title,
    score: p.score,
    num_comments: p.num_comments,
    created_utc: p.created_utc,
    over_18: !!p.over_18,
    stickied: !!p.stickied,
    locked: !!p.locked,
    url: p.url,
    permalink: p.permalink,
    flair_text: p.link_flair_text || null,
  };
}

export function summarizeComment(c, depth = 0) {
  return {
    fullname: c.name || (c.id ? `t1_${c.id}` : null),
    id: c.id,
    parent_id: c.parent_id,
    author: c.author,
    body: c.body,
    score: c.score,
    depth,
    created_utc: c.created_utc,
    distinguished: c.distinguished || null,
  };
}

export async function fetchPostWithComments(http, db, cfg, params = {}) {
  const target = normalizePostTarget(params.post);
  const authMode = pickAuthMode(cfg, params.authMode);
  const startedAt = new Date().toISOString();
  let path;
  if (target.kind === 'permalink') {
    path = ensureDotJson(target.path);
  } else if (target.shortId) {
    path = `/comments/${target.shortId}.json`;
  } else {
    throw new Error(`Unable to resolve post target: ${params.post}`);
  }
  const query = {
    raw_json: 1,
    sort: params.commentSort || 'confidence',
    limit: Math.min(Math.max(Number(params.commentLimit) || 200, 1), 500),
  };
  if (params.depth != null) query.depth = Math.min(Math.max(Number(params.depth) || 0, 0), 10);
  try {
    const res = await http.getJson(path, { query, authMode, signal: params.signal });
    const json = res.json;
    if (!Array.isArray(json) || json.length < 2) throw new Error('Unexpected comments response shape (expected [postListing, commentListing]).');
    const postListing = json[0]?.data?.children || [];
    const postData = postListing[0]?.data;
    if (!postData) throw new Error('Post not found in response.');
    const commentListing = json[1]?.data?.children || [];
    const postFullname = db.upsertPost ? (postData.name || `t3_${postData.id}`) : (postData.name || `t3_${postData.id}`);
    const fetchedAt = new Date().toISOString();
    if (params.store !== false) {
      db.tx(() => {
        db.upsertPost(postData, authMode, fetchedAt);
        if (postData.subreddit) db.upsertSubreddit({ display_name: postData.subreddit, name: postData.subreddit_id }, fetchedAt);
      });
    }
    db.auditFetch({ kind: 'get_post', target: postFullname, params: query, authMode, status: 'ok', httpStatus: res.status, items: 1 + commentListing.length, startedAt, finishedAt: fetchedAt });
    return { ok: true, authMode, post: postData, postFullname, commentChildren: commentListing, fetchedAt };
  } catch (e) {
    db.auditFetch({ kind: 'get_post', target: String(params.post), params, authMode: pickAuthMode(cfg, params.authMode), status: 'error', error: e.message, startedAt, finishedAt: new Date().toISOString() });
    throw e;
  }
}
