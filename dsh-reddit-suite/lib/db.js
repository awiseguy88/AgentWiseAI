import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { safeJson } from './config.js';

function nowIso() { return new Date().toISOString(); }

export class RedditDb {
  constructor(dbPath, opts = {}) {
    this.dbPath = dbPath;
    this.storeRawJson = opts.storeRawJson !== false;
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    this.migrate();
    this._prepare();
  }

  migrate() {
    const v = this.db.prepare('PRAGMA user_version').get().user_version || 0;
    if (v < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS subreddits (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE,
          title TEXT,
          subreddit_type TEXT,
          over18 INTEGER,
          subscribers INTEGER,
          description TEXT,
          first_seen_at TEXT,
          last_seen_at TEXT,
          raw_json TEXT
        );
        CREATE TABLE IF NOT EXISTS posts (
          fullname TEXT PRIMARY KEY,
          id TEXT,
          subreddit TEXT,
          author TEXT,
          title TEXT,
          selftext TEXT,
          url TEXT,
          permalink TEXT,
          created_utc REAL,
          score INTEGER,
          ups INTEGER,
          num_comments INTEGER,
          over_18 INTEGER,
          stickied INTEGER,
          locked INTEGER,
          archived INTEGER,
          flair_text TEXT,
          fetched_at TEXT,
          source_mode TEXT,
          raw_json TEXT
        );
        CREATE TABLE IF NOT EXISTS comments (
          fullname TEXT PRIMARY KEY,
          id TEXT,
          post_fullname TEXT,
          parent_fullname TEXT,
          author TEXT,
          body TEXT,
          created_utc REAL,
          score INTEGER,
          depth INTEGER,
          is_more_expanded INTEGER DEFAULT 0,
          controversiality INTEGER,
          distinguished TEXT,
          fetched_at TEXT,
          raw_json TEXT
        );
        CREATE TABLE IF NOT EXISTS more_nodes (
          key TEXT PRIMARY KEY,
          post_fullname TEXT,
          parent_fullname TEXT,
          more_id TEXT,
          children_json TEXT,
          count INTEGER,
          depth INTEGER,
          status TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS fetch_audit (
          id TEXT PRIMARY KEY,
          kind TEXT,
          target TEXT,
          params_json TEXT,
          auth_mode TEXT,
          status TEXT,
          http_status INTEGER,
          items INTEGER,
          error TEXT,
          started_at TEXT,
          finished_at TEXT
        );
        CREATE TABLE IF NOT EXISTS action_audit (
          id TEXT PRIMARY KEY,
          action TEXT,
          target TEXT,
          params_json TEXT,
          auth_mode TEXT,
          dry_run INTEGER,
          confirmed INTEGER,
          status TEXT,
          http_status INTEGER,
          response_id TEXT,
          error TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS oauth_tokens (
          id TEXT PRIMARY KEY,
          client_id TEXT,
          scope TEXT,
          access_token TEXT,
          refresh_token TEXT,
          token_type TEXT,
          expires_at TEXT,
          raw_json TEXT,
          updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_posts_sub_created ON posts(subreddit, created_utc DESC);
        CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
        CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_fullname);
        CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_fullname);
        CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author);
        CREATE INDEX IF NOT EXISTS idx_more_post_status ON more_nodes(post_fullname, status);
        CREATE INDEX IF NOT EXISTS idx_fetch_audit_finished ON fetch_audit(finished_at DESC);
        CREATE INDEX IF NOT EXISTS idx_action_audit_created ON action_audit(created_at DESC);
        PRAGMA user_version = 1;
      `);
    }
  }

  _prepare() {
    this.stmts = {
      upsertSubreddit: this.db.prepare(`
        INSERT INTO subreddits (id,name,title,subreddit_type,over18,subscribers,description,first_seen_at,last_seen_at,raw_json)
        VALUES (@id,@name,@title,@subreddit_type,@over18,@subscribers,@description,@now,@now,@raw_json)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, title=COALESCE(excluded.title,title), subreddit_type=COALESCE(excluded.subreddit_type,subreddit_type),
          over18=COALESCE(excluded.over18,over18), subscribers=COALESCE(excluded.subscribers,subscribers),
          description=COALESCE(excluded.description,description), last_seen_at=excluded.last_seen_at,
          raw_json=COALESCE(excluded.raw_json,raw_json)
      `),
      upsertPost: this.db.prepare(`
        INSERT INTO posts (fullname,id,subreddit,author,title,selftext,url,permalink,created_utc,score,ups,num_comments,over_18,stickied,locked,archived,flair_text,fetched_at,source_mode,raw_json)
        VALUES (@fullname,@id,@subreddit,@author,@title,@selftext,@url,@permalink,@created_utc,@score,@ups,@num_comments,@over_18,@stickied,@locked,@archived,@flair_text,@fetched_at,@source_mode,@raw_json)
        ON CONFLICT(fullname) DO UPDATE SET
          id=excluded.id, subreddit=COALESCE(excluded.subreddit,subreddit), author=COALESCE(excluded.author,author), title=COALESCE(excluded.title,title),
          selftext=COALESCE(excluded.selftext,selftext), url=COALESCE(excluded.url,url), permalink=COALESCE(excluded.permalink,permalink),
          created_utc=COALESCE(excluded.created_utc,created_utc), score=COALESCE(excluded.score,score), ups=COALESCE(excluded.ups,ups),
          num_comments=COALESCE(excluded.num_comments,num_comments), over_18=COALESCE(excluded.over_18,over_18), stickied=COALESCE(excluded.stickied,stickied),
          locked=COALESCE(excluded.locked,locked), archived=COALESCE(excluded.archived,archived), flair_text=COALESCE(excluded.flair_text,flair_text),
          fetched_at=excluded.fetched_at, source_mode=COALESCE(excluded.source_mode,source_mode), raw_json=COALESCE(excluded.raw_json,raw_json)
      `),
      upsertComment: this.db.prepare(`
        INSERT INTO comments (fullname,id,post_fullname,parent_fullname,author,body,created_utc,score,depth,is_more_expanded,controversiality,distinguished,fetched_at,raw_json)
        VALUES (@fullname,@id,@post_fullname,@parent_fullname,@author,@body,@created_utc,@score,@depth,@is_more_expanded,@controversiality,@distinguished,@fetched_at,@raw_json)
        ON CONFLICT(fullname) DO UPDATE SET
          id=excluded.id, post_fullname=COALESCE(excluded.post_fullname,post_fullname), parent_fullname=COALESCE(excluded.parent_fullname,parent_fullname),
          author=COALESCE(excluded.author,author), body=COALESCE(excluded.body,body), created_utc=COALESCE(excluded.created_utc,created_utc),
          score=COALESCE(excluded.score,score), depth=COALESCE(excluded.depth,depth),
          is_more_expanded=CASE WHEN excluded.is_more_expanded=1 THEN 1 ELSE is_more_expanded END,
          controversiality=COALESCE(excluded.controversiality,controversiality), distinguished=COALESCE(excluded.distinguished,distinguished),
          fetched_at=excluded.fetched_at, raw_json=COALESCE(excluded.raw_json,raw_json)
      `),
      upsertMore: this.db.prepare(`
        INSERT INTO more_nodes (key,post_fullname,parent_fullname,more_id,children_json,count,depth,status,updated_at)
        VALUES (@key,@post_fullname,@parent_fullname,@more_id,@children_json,@count,@depth,@status,@updated_at)
        ON CONFLICT(key) DO UPDATE SET
          children_json=excluded.children_json, count=excluded.count, depth=excluded.depth, status=excluded.status, updated_at=excluded.updated_at
      `),
      getMorePending: this.db.prepare(`SELECT * FROM more_nodes WHERE post_fullname=? AND status='pending' ORDER BY depth ASC`),
      insertFetchAudit: this.db.prepare(`INSERT INTO fetch_audit (id,kind,target,params_json,auth_mode,status,http_status,items,error,started_at,finished_at) VALUES (@id,@kind,@target,@params_json,@auth_mode,@status,@http_status,@items,@error,@started_at,@finished_at)`),
      insertActionAudit: this.db.prepare(`INSERT INTO action_audit (id,action,target,params_json,auth_mode,dry_run,confirmed,status,http_status,response_id,error,created_at) VALUES (@id,@action,@target,@params_json,@auth_mode,@dry_run,@confirmed,@status,@http_status,@response_id,@error,@created_at)`),
      upsertToken: this.db.prepare(`
        INSERT INTO oauth_tokens (id,client_id,scope,access_token,refresh_token,token_type,expires_at,raw_json,updated_at)
        VALUES (@id,@client_id,@scope,@access_token,@refresh_token,@token_type,@expires_at,@raw_json,@updated_at)
        ON CONFLICT(id) DO UPDATE SET
          client_id=COALESCE(excluded.client_id,client_id), scope=COALESCE(excluded.scope,scope),
          access_token=COALESCE(excluded.access_token,access_token), refresh_token=COALESCE(excluded.refresh_token,refresh_token),
          token_type=COALESCE(excluded.token_type,token_type), expires_at=COALESCE(excluded.expires_at,expires_at),
          raw_json=COALESCE(excluded.raw_json,raw_json), updated_at=excluded.updated_at
      `),
      getToken: this.db.prepare(`SELECT * FROM oauth_tokens WHERE id='default'`),
    };
  }

  close() { try { this.db.close(); } catch {} }

  tx(fn) {
    this.db.exec('BEGIN');
    try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
  }

  raw(obj) { return this.storeRawJson && obj ? safeJson(obj) : null; }

  upsertSubreddit(sub, now = nowIso()) {
    if (!sub) return;
    const name = (sub.display_name || sub.subreddit || sub.name || '').toString().replace(/^r\//i, '');
    const id = (sub.name && String(sub.name).startsWith('t5_')) ? String(sub.name) : (sub.id ? `t5_${sub.id}` : `name:${name.toLowerCase()}`);
    this.stmts.upsertSubreddit.run({
      id, name: name || null, title: sub.title ?? null, subreddit_type: sub.subreddit_type ?? null,
      over18: sub.over18 ? 1 : 0, subscribers: sub.subscribers ?? null, description: sub.public_description ?? sub.description ?? null,
      now, raw_json: this.raw(sub),
    });
  }

  upsertPost(post, sourceMode, fetchedAt = nowIso()) {
    if (!post) return null;
    const id = post.id || (String(post.name || '').replace(/^t3_/, ''));
    const fullname = post.name && String(post.name).startsWith('t3_') ? String(post.name) : (id ? `t3_${id}` : null);
    if (!fullname) return null;
    const rec = {
      fullname, id: id || null, subreddit: post.subreddit ?? null, author: post.author ?? null,
      title: post.title ?? null, selftext: post.selftext ?? null, url: post.url ?? post.url_overridden_by_dest ?? null,
      permalink: post.permalink ?? null, created_utc: post.created_utc ?? null, score: post.score ?? null, ups: post.ups ?? null,
      num_comments: post.num_comments ?? null, over_18: post.over_18 ? 1 : 0, stickied: post.stickied ? 1 : 0,
      locked: post.locked ? 1 : 0, archived: post.archived ? 1 : 0, flair_text: post.link_flair_text ?? null,
      fetched_at: fetchedAt, source_mode: sourceMode || null, raw_json: this.raw(post),
    };
    this.stmts.upsertPost.run(rec);
    return fullname;
  }

  upsertComment(c, postFullname, depth = 0, fetchedAt = nowIso()) {
    if (!c) return null;
    const id = c.id || (String(c.name || '').replace(/^t1_/, ''));
    const fullname = c.name && String(c.name).startsWith('t1_') ? String(c.name) : (id ? `t1_${id}` : null);
    if (!fullname) return null;
    this.stmts.upsertComment.run({
      fullname, id: id || null, post_fullname: postFullname || c.link_id || null, parent_fullname: c.parent_id || null,
      author: c.author ?? null, body: c.body ?? null, created_utc: c.created_utc ?? null, score: c.score ?? null,
      depth: depth ?? null, is_more_expanded: 0, controversiality: c.controversiality ?? null,
      distinguished: c.distinguished ?? null, fetched_at: fetchedAt, raw_json: this.raw(c),
    });
    return fullname;
  }

  upsertMore(postFullname, parentFullname, more, depth, status = 'pending') {
    const moreId = more.id || more.name || `more-${(more.children||[]).join(',').slice(0,40)}`;
    const key = `${postFullname}|${parentFullname}|${moreId}`;
    this.stmts.upsertMore.run({
      key, post_fullname: postFullname, parent_fullname: parentFullname || postFullname, more_id: String(moreId),
      children_json: safeJson(more.children || []), count: Number(more.count ?? (more.children||[]).length ?? 0),
      depth: depth ?? 0, status, updated_at: nowIso(),
    });
    return key;
  }

  markMoreStatus(postFullname, parentFullname, moreId, status) {
    const key = `${postFullname}|${parentFullname}|${moreId}`;
    this.db.prepare(`UPDATE more_nodes SET status=?, updated_at=? WHERE key=?`).run(status, nowIso(), key);
  }

  pendingMore(postFullname) { return this.stmts.getMorePending.all(postFullname); }

  auditFetch(entry) {
    const id = randomUUID();
    this.stmts.insertFetchAudit.run({ id, kind: entry.kind, target: entry.target, params_json: safeJson(entry.params||{}), auth_mode: entry.authMode||null, status: entry.status||'ok', http_status: entry.httpStatus??null, items: entry.items??null, error: entry.error||null, started_at: entry.startedAt||nowIso(), finished_at: entry.finishedAt||nowIso() });
    return id;
  }
  auditAction(entry) {
    const id = randomUUID();
    this.stmts.insertActionAudit.run({ id, action: entry.action, target: entry.target, params_json: safeJson(entry.params||{}), auth_mode: entry.authMode||null, dry_run: entry.dryRun?1:0, confirmed: entry.confirmed?1:0, status: entry.status||'ok', http_status: entry.httpStatus??null, response_id: entry.responseId||null, error: entry.error||null, created_at: entry.createdAt||nowIso() });
    return id;
  }

  saveToken(tok) {
    this.stmts.upsertToken.run({
      id: 'default', client_id: tok.client_id || null, scope: tok.scope || null,
      access_token: tok.access_token || null, refresh_token: tok.refresh_token || null,
      token_type: tok.token_type || null, expires_at: tok.expires_at || null,
      raw_json: tok.raw_json || (this.storeRawJson ? safeJson(tok) : null), updated_at: nowIso(),
    });
  }
  getToken() { return this.stmts.getToken.get() || null; }

  stats() {
    const q = (sql) => this.db.prepare(sql).get();
    const subreddits = q('SELECT COUNT(*) c FROM subreddits').c;
    const posts = q('SELECT COUNT(*) c FROM posts').c;
    const comments = q('SELECT COUNT(*) c FROM comments').c;
    const morePending = q("SELECT COUNT(*) c FROM more_nodes WHERE status='pending'").c;
    const moreTotal = q('SELECT COUNT(*) c FROM more_nodes').c;
    const fetches = q('SELECT COUNT(*) c FROM fetch_audit').c;
    const actions = q('SELECT COUNT(*) c FROM action_audit').c;
    const recentFetch = this.db.prepare('SELECT kind,target,status,items,error,finished_at FROM fetch_audit ORDER BY finished_at DESC LIMIT 5').all();
    const recentAction = this.db.prepare('SELECT action,target,status,dry_run,error,created_at FROM action_audit ORDER BY created_at DESC LIMIT 5').all();
    return { dbPath: this.dbPath, counts: { subreddits, posts, comments, morePending, moreTotal, fetches, actions }, recentFetch, recentAction };
  }

  queryPosts({ subreddit, author, q, limit = 25, offset = 0 } = {}) {
    const where = []; const args = [];
    if (subreddit) { where.push('LOWER(subreddit)=LOWER(?)'); args.push(subreddit.replace(/^r\//i,'')); }
    if (author) { where.push('LOWER(author)=LOWER(?)'); args.push(author); }
    if (q) { where.push('(title LIKE ? OR selftext LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
    const sql = `SELECT fullname,id,subreddit,author,title,score,num_comments,created_utc,permalink,url,fetched_at FROM posts ${where.length? 'WHERE '+where.join(' AND '):''} ORDER BY created_utc DESC LIMIT ? OFFSET ?`;
    args.push(Math.min(Number(limit)||25, 200), Math.max(Number(offset)||0,0));
    return this.db.prepare(sql).all(...args);
  }

  queryComments({ postId, author, q, limit = 50, offset = 0 } = {}) {
    const where = []; const args = [];
    if (postId) {
      const pf = postId.startsWith('t3_') ? postId : `t3_${postId}`;
      where.push('post_fullname=?'); args.push(pf);
    }
    if (author) { where.push('LOWER(author)=LOWER(?)'); args.push(author); }
    if (q) { where.push('body LIKE ?'); args.push(`%${q}%`); }
    const sql = `SELECT fullname,post_fullname,parent_fullname,author,body,score,depth,created_utc FROM comments ${where.length? 'WHERE '+where.join(' AND '):''} ORDER BY depth ASC, created_utc ASC LIMIT ? OFFSET ?`;
    args.push(Math.min(Number(limit)||50, 500), Math.max(Number(offset)||0,0));
    return this.db.prepare(sql).all(...args);
  }

  getPost(fullname) { return this.db.prepare('SELECT * FROM posts WHERE fullname=?').get(fullname); }
  getCommentsForPost(fullname) { return this.db.prepare('SELECT fullname,parent_fullname,author,body,score,depth,created_utc FROM comments WHERE post_fullname=? ORDER BY depth ASC, created_utc ASC').all(fullname); }
}
