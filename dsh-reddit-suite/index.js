import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { mkdirSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { normalizeConfig, resolveDbPath, redactSecrets, pickAuthMode, assertAuthAvailable, requireWriteAccess, safeJson } from "./lib/config.js";
import { RedditHttpClient } from "./lib/http.js";
import { RedditDb } from "./lib/db.js";
import { browseSubreddit, fetchPostWithComments, summarizePost, summarizeComment } from "./lib/reddit-read.js";
import { expandAllMore } from "./lib/reddit-more.js";
import { buildOauthAuthorizeUrl, exchangeOauthCodeDirect, refreshOauthToken, attemptWebLogin, submitLoginChallenge, authStatus } from "./lib/reddit-auth.js";
import { submitPost, submitComment, editThing, deleteThing, vote, modAction } from "./lib/reddit-write.js";

export const name = "dsh-reddit-suite";
export const inject = ["tools"];

export const Config = z.object({
  authMode: z.union(["session_cookie", "oauth", "auto"]).default("auto"),
  cookie: z.string().default(""),
  userAgent: z.string().default("dsh-reddit-suite/1.0 (DeepSeek Harness host plugin)"),
  baseUrl: z.string().default("https://www.reddit.com"),
  oauthBaseUrl: z.string().default("https://oauth.reddit.com"),
  dbPath: z.string().default(""),
  requestTimeoutMs: z.number().min(1).default(30000),
  minIntervalMs: z.number().min(0).default(1200),
  maxRetries: z.number().min(0).default(3),
  retryBackoffMs: z.number().min(1).default(1500),
  maxMoreBatches: z.number().min(1).default(50),
  maxMoreChildren: z.number().min(1).default(5000),
  maxCommentDepth: z.number().min(1).default(200),
  maxItemsPerCall: z.number().min(1).default(100),
  storeRawJson: z.boolean().default(true),
  enableWriteActions: z.boolean().default(false),
  oauth: z.object({
    clientId: z.string().default(""),
    clientSecret: z.string().default(""),
    redirectUri: z.string().default(""),
    scope: z.string().default("identity read"),
    duration: z.string().default("permanent"),
    accessToken: z.string().default(""),
    refreshToken: z.string().default(""),
    tokenExpiry: z.string().default(""),
  }).default({}),
  login: z.object({
    username: z.string().default(""),
    password: z.string().default(""),
    otp: z.string().default(""),
  }).default({}),
  captchaSolver: z.object({
    type: z.string().default(""),
    url: z.string().default(""),
    method: z.string().default("POST"),
    apiKey: z.string().default(""),
  }).default({}),
});

function textResult(obj) {
  const redacted = redactSecrets(obj);
  return JSON.stringify(redacted, null, 2);
}

function okValue(obj) { return { ok: true, ...obj }; }
function errValue(e, extra = {}) {
  return { ok: false, error: e?.message || String(e), ...extra };
}

function buildTree(comments) {
  // comments: array with parent_fullname; return nested summary limited
  const byParent = new Map();
  for (const c of comments) {
    const p = c.parent_fullname || 'root';
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(c);
  }
  function node(c, depth, budget) {
    if (budget.left <= 0) return null;
    budget.left--;
    const children = (byParent.get(c.fullname) || []).slice(0, 50).map(ch => node(ch, depth + 1, budget)).filter(Boolean);
    return { fullname: c.fullname, author: c.author, score: c.score, depth, body: (c.body || '').slice(0, 500), children };
  }
  const roots = (byParent.get('root') || byParent.get(comments[0]?.post_fullname) || []).slice(0, 100);
  const budget = { left: 400 };
  return roots.map(r => node(r, r.depth || 0, budget)).filter(Boolean);
}

export function apply(ctx, config) {
  const cfg = normalizeConfig(config || {});
  let dbInstance = null;
  let httpInstance = null;

  function getDb() {
    if (dbInstance) return dbInstance;
    const p = resolveDbPath(cfg, ctx);
    dbInstance = new RedditDb(p, { storeRawJson: cfg.storeRawJson });
    return dbInstance;
  }
  function getHttp() {
    if (!httpInstance) httpInstance = new RedditHttpClient(cfg);
    // keep config ref fresh
    httpInstance.cfg = cfg;
    return httpInstance;
  }

  ctx.effect(() => () => {
    try { dbInstance?.close(); } catch {}
    dbInstance = null;
  });

  // Helper to run and wrap errors
  async function run(label, fn) {
    try { return await fn(); } catch (e) { return errValue(e, { label }); }
  }

  // --- Read tools ---
  ctx.tools.register(defineTool({
    name: "reddit_browse_subreddit",
    description: "Browse/list a subreddit's posts (hot/new/top/rising/controversial) using configured session cookie or OAuth. Stores fetched posts/subreddit data into the local SQLite database by default.",
    parameters: {
      subreddit: { type: "string", required: true, description: "Subreddit name (with or without r/ prefix)." },
      sort: { type: "string", description: "Listing sort: hot, new, top, rising, controversial. Default hot." },
      t: { type: "string", description: "Time window for top/controversial: hour, day, week, month, year, all." },
      limit: { type: "number", description: "Max posts to fetch (capped by config.maxItemsPerCall)." },
      after: { type: "string", description: "Pagination cursor (fullname) to fetch after." },
      before: { type: "string", description: "Pagination cursor to fetch before." },
      authMode: { type: "string", description: "Auth mode override: session_cookie, oauth, or auto." },
      store: { type: "boolean", description: "Whether to store results in SQLite. Default true." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('browse_subreddit', async () => {
        const r = await browseSubreddit(getHttp(), getDb(), cfg, args);
        return r;
      });
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_get_post",
    description: "Fetch a Reddit post and its comments, fully recursively expanding all 'more' comment continuations (within configured safety caps), and store results into the local SQLite database by default.",
    parameters: {
      post: { type: "string", required: true, description: "Post id, fullname (t3_xxx), permalink, or full URL." },
      commentSort: { type: "string", description: "Comment sort: confidence, top, new, controversial, old, qa." },
      commentLimit: { type: "number", description: "Initial comment fetch limit (max 500)." },
      depth: { type: "number", description: "Initial comment depth hint (Reddit may still return more/mixed)." },
      expandMore: { type: "boolean", description: "Recursively expand all 'more' continuations. Default true." },
      authMode: { type: "string", description: "Auth mode override: session_cookie, oauth, or auto." },
      store: { type: "boolean", description: "Store post/comments in SQLite. Default true." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('get_post', async () => {
        const db = getDb();
        const http = getHttp();
        const res = await fetchPostWithComments(http, db, cfg, args);
        let expansion = null;
        if (args.expandMore !== false) {
          expansion = await expandAllMore(http, db, cfg, {
            postFullname: res.postFullname,
            initialChildren: res.commentChildren,
            linkId: res.postFullname,
            authMode: args.authMode,
          });
        } else if (args.store !== false) {
          // still ingest visible comments/more markers without expansion
          const pending = [];
          db.tx(() => {
            // store visible
            const walk = (children, parent, depth) => {
              for (const ch of (children||[])) {
                if (ch?.kind === 't1' && ch.data) {
                  db.upsertComment(ch.data, res.postFullname, depth);
                  if (ch.data.replies?.data?.children) walk(ch.data.replies.data.children, ch.data.name, depth+1);
                } else if (ch?.kind === 'more' && ch.data) {
                  db.upsertMore(res.postFullname, parent || res.postFullname, ch.data, depth, 'pending');
                }
              }
            };
            walk(res.commentChildren, res.postFullname, 0);
          });
          expansion = { ok: true, skipped: true, reason: 'expandMore=false', remaining: db.pendingMore(res.postFullname).length };
        }
        const storedComments = db.getCommentsForPost(res.postFullname);
        const sampleTree = buildTree(storedComments.slice(0, 500));
        return {
          ok: true,
          authMode: res.authMode,
          post: summarizePost(res.post),
          postFullname: res.postFullname,
          expansion,
          storedCommentCount: storedComments.length,
          commentTreeSample: sampleTree,
          note: storedComments.length > 500 ? 'commentTreeSample truncated to 500 stored comments; query DB for full set.' : undefined,
        };
      });
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_expand_more",
    description: "Explicitly expand pending 'more' comment continuations for a post already known/stored in the database (or re-fetch context not required beyond post fullname). Continues until complete or safety caps reached.",
    parameters: {
      post: { type: "string", required: true, description: "Post fullname (t3_xxx) or id/permalink/URL; will be normalized." },
      authMode: { type: "string", description: "Auth mode override." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('expand_more', async () => {
        const db = getDb();
        const http = getHttp();
        // normalize to fullname
        let fullname = String(args.post||'').trim();
        if (!fullname.startsWith('t3_')) {
          // try extract
          const m = fullname.match(/\/comments\/([a-z0-9]+)/i) || fullname.match(/^([a-z0-9]+)$/i);
          if (m) fullname = `t3_${m[1]}`;
        }
        if (!fullname.startsWith('t3_')) throw new Error('Could not normalize post to a t3_ fullname.');
        const expansion = await expandAllMore(http, db, cfg, { postFullname: fullname, initialChildren: [], linkId: fullname, authMode: args.authMode });
        const storedCommentCount = db.getCommentsForPost(fullname).length;
        return { ...expansion, storedCommentCount };
      });
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_db_stats",
    description: "Show local Reddit SQLite database path, table counts, pending more nodes, and recent fetch/action audit entries. No network access.",
    parameters: {},
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute() {
      return run('db_stats', async () => ({ ok: true, ...getDb().stats() }));
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_db_query_posts",
    description: "Query posts stored in the local Reddit SQLite database by subreddit, author, or text search. Read-only.",
    parameters: {
      subreddit: { type: "string", description: "Filter by subreddit name." },
      author: { type: "string", description: "Filter by author." },
      q: { type: "string", description: "Text search (LIKE) over title and selftext." },
      limit: { type: "number", description: "Max rows (<=200)." },
      offset: { type: "number", description: "Offset for pagination." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('db_query_posts', async () => ({ ok: true, posts: getDb().queryPosts(args) }));
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_db_query_comments",
    description: "Query comments stored in the local Reddit SQLite database by post id/fullname, author, or text search. Read-only.",
    parameters: {
      postId: { type: "string", description: "Post id or fullname (t3_xxx) to scope comments." },
      author: { type: "string", description: "Filter by author." },
      q: { type: "string", description: "Text search (LIKE) over comment body." },
      limit: { type: "number", description: "Max rows (<=500)." },
      offset: { type: "number", description: "Offset for pagination." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('db_query_comments', async () => ({ ok: true, comments: getDb().queryComments(args) }));
    },
  }));

  // --- Auth / OAuth / login tools ---
  ctx.tools.register(defineTool({
    name: "reddit_auth_status",
    description: "Report configured/available Reddit auth state (session cookie present, OAuth tokens present/configured, captcha solver configured, write actions enabled). Never returns secret values.",
    parameters: {},
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute() {
      return run('auth_status', async () => ({ ok: true, ...authStatus(cfg, getDb()) }));
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_oauth_begin",
    description: "Generate a Reddit OAuth authorization URL for a non-GUI code-paste flow. User opens URL in browser, authorizes, then provides the returned code/state to reddit_oauth_exchange.",
    parameters: {
      clientId: { type: "string", description: "OAuth client id (or use config.oauth.clientId)." },
      redirectUri: { type: "string", description: "Redirect URI registered with the app." },
      scope: { type: "string", description: "Space-separated scopes (e.g. 'identity read submit vote modposts')." },
      duration: { type: "string", description: "temporary or permanent." },
      state: { type: "string", description: "Optional state/CSRF token." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('oauth_begin', async () => ({ ok: true, ...buildOauthAuthorizeUrl(cfg, args) }));
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_oauth_exchange",
    description: "Exchange a Reddit OAuth authorization code for access/refresh tokens. Persists tokens to local DB by default and updates runtime config for subsequent calls (secrets not returned).",
    parameters: {
      code: { type: "string", required: true, description: "Authorization code from redirect URL." },
      clientId: { type: "string", description: "OAuth client id override." },
      clientSecret: { type: "string", description: "OAuth client secret override (if applicable)." },
      redirectUri: { type: "string", description: "Redirect URI used in authorization." },
      persist: { type: "boolean", description: "Persist tokens to local DB. Default true." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('oauth_exchange', async () => exchangeOauthCodeDirect(fetch, getDb(), cfg, args));
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_oauth_refresh",
    description: "Refresh the Reddit OAuth access token using a refresh token (from params, config, or persisted DB token). Updates runtime config and persists by default.",
    parameters: {
      clientId: { type: "string", description: "OAuth client id override." },
      clientSecret: { type: "string", description: "OAuth client secret override." },
      refreshToken: { type: "string", description: "Refresh token override." },
      persist: { type: "boolean", description: "Persist updated token to DB. Default true." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('oauth_refresh', async () => refreshOauthToken(getDb(), cfg, args));
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_login",
    description: "Attempt automated Reddit web login using username/password (and optional OTP). Detects CAPTCHA/challenges and returns structured challenge info; if successful captures session cookie into runtime config. Does not bypass CAPTCHA autonomously—use reddit_submit_login_challenge with a manual/external solution if required.",
    parameters: {
      username: { type: "string", description: "Reddit username (or config.login.username)." },
      password: { type: "string", description: "Reddit password (or config.login.password)." },
      otp: { type: "string", description: "2FA OTP if required." },
      captchaId: { type: "string", description: "CAPTCHA id (iden) if retrying with a solution." },
      captchaResponse: { type: "string", description: "CAPTCHA solution/response if retrying." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('login', async () => attemptWebLogin(getHttp(), getDb(), cfg, args));
    },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_submit_login_challenge",
    description: "Continue a login flow by submitting a CAPTCHA/challenge solution (manual or via configured external HTTP captcha solver hook), then retry login.",
    parameters: {
      username: { type: "string", description: "Reddit username." },
      password: { type: "string", description: "Reddit password." },
      otp: { type: "string", description: "2FA OTP if required." },
      captchaId: { type: "string", required: true, description: "CAPTCHA id (iden) from challenge." },
      captchaResponse: { type: "string", description: "Manual CAPTCHA solution text/token. If omitted, configured captchaSolver hook may be invoked." },
    },
    output: {
      schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } },
      render: (_a, v) => [{ type: "text", text: textResult(v) }],
    },
    async execute(args) {
      return run('submit_login_challenge', async () => submitLoginChallenge(getHttp(), getDb(), cfg, args));
    },
  }));

  // --- Write/mod tools (gated) ---
  ctx.tools.register(defineTool({
    name: "reddit_submit_post",
    description: "Submit a new Reddit post. GATED: requires config.enableWriteActions=true and confirm=true. Supports dryRun.",
    parameters: {
      subreddit: { type: "string", required: true, description: "Target subreddit name." },
      kind: { type: "string", description: "Post kind: self or link. Default self." },
      title: { type: "string", required: true, description: "Post title." },
      text: { type: "string", description: "Self post body text." },
      url: { type: "string", description: "Link URL for link posts." },
      nsfw: { type: "boolean", description: "Mark NSFW." },
      spoiler: { type: "boolean", description: "Mark spoiler." },
      flair_id: { type: "string", description: "Flair template id." },
      flair_text: { type: "string", description: "Flair text." },
      authMode: { type: "string", description: "Auth mode override." },
      confirm: { type: "boolean", description: "Must be true to execute (not required for dryRun=true)." },
      dryRun: { type: "boolean", description: "If true, validate and audit as dry run without calling Reddit." },
    },
    output: { schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } }, render: (_a, v) => [{ type: "text", text: textResult(v) }] },
    async execute(args) { return run('submit_post', async () => submitPost(getHttp(), getDb(), cfg, args)); },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_submit_comment",
    description: "Submit a comment/reply to a post or comment. GATED: requires config.enableWriteActions=true and confirm=true. Supports dryRun.",
    parameters: {
      thingId: { type: "string", required: true, description: "Parent fullname (t3_xxx post or t1_xxx comment)." },
      text: { type: "string", required: true, description: "Comment body text." },
      authMode: { type: "string", description: "Auth mode override." },
      confirm: { type: "boolean", description: "Must be true to execute." },
      dryRun: { type: "boolean", description: "Dry run without side effects." },
    },
    output: { schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } }, render: (_a, v) => [{ type: "text", text: textResult(v) }] },
    async execute(args) { return run('submit_comment', async () => submitComment(getHttp(), getDb(), cfg, args)); },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_edit",
    description: "Edit a Reddit thing (post/comment) you own. GATED: requires config.enableWriteActions=true and confirm=true. Supports dryRun.",
    parameters: {
      thingId: { type: "string", required: true, description: "Fullname of thing to edit." },
      text: { type: "string", required: true, description: "New text body." },
      authMode: { type: "string", description: "Auth mode override." },
      confirm: { type: "boolean", description: "Must be true to execute." },
      dryRun: { type: "boolean", description: "Dry run." },
    },
    output: { schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } }, render: (_a, v) => [{ type: "text", text: textResult(v) }] },
    async execute(args) { return run('edit', async () => editThing(getHttp(), getDb(), cfg, args)); },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_delete",
    description: "Delete a Reddit thing you own. GATED: requires config.enableWriteActions=true and confirm=true. Supports dryRun.",
    parameters: {
      thingId: { type: "string", required: true, description: "Fullname of thing to delete." },
      authMode: { type: "string", description: "Auth mode override." },
      confirm: { type: "boolean", description: "Must be true to execute." },
      dryRun: { type: "boolean", description: "Dry run." },
    },
    output: { schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } }, render: (_a, v) => [{ type: "text", text: textResult(v) }] },
    async execute(args) { return run('delete', async () => deleteThing(getHttp(), getDb(), cfg, args)); },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_vote",
    description: "Vote on a Reddit thing. GATED: requires config.enableWriteActions=true and confirm=true. Supports dryRun.",
    parameters: {
      thingId: { type: "string", required: true, description: "Fullname of thing to vote on." },
      dir: { type: "number", required: true, description: "Vote direction: 1 (upvote), 0 (clear), -1 (downvote)." },
      authMode: { type: "string", description: "Auth mode override." },
      confirm: { type: "boolean", description: "Must be true to execute." },
      dryRun: { type: "boolean", description: "Dry run." },
    },
    output: { schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } }, render: (_a, v) => [{ type: "text", text: textResult(v) }] },
    async execute(args) { return run('vote', async () => vote(getHttp(), getDb(), cfg, args)); },
  }));

  ctx.tools.register(defineTool({
    name: "reddit_mod_action",
    description: "Perform a moderation action (approve, remove, spam, distinguish, lock, unlock, sticky, ignore_reports, unignore_reports, or pass-through path+form). GATED: requires config.enableWriteActions=true and confirm=true. Supports dryRun.",
    parameters: {
      action: { type: "string", required: true, description: "Moderation action name." },
      thingId: { type: "string", description: "Target thing fullname/id." },
      subreddit: { type: "string", description: "Subreddit context if relevant." },
      how: { type: "string", description: "For distinguish: yes, no, admin, special." },
      spam: { type: "boolean", description: "For remove: mark as spam." },
      sticky: { type: "boolean", description: "For distinguish/sticky options." },
      state: { type: "boolean", description: "For sticky: enable/disable." },
      num: { type: "number", description: "Sticky slot number if applicable." },
      path: { type: "string", description: "Advanced: explicit API path for pass-through action." },
      form: { type: "object", description: "Advanced: form fields for pass-through action.", additionalProperties: true },
      authMode: { type: "string", description: "Auth mode override." },
      confirm: { type: "boolean", description: "Must be true to execute." },
      dryRun: { type: "boolean", description: "Dry run." },
    },
    output: { schema: { type: "object", additionalProperties: true, properties: { ok: { type: "boolean", required: true } } }, render: (_a, v) => [{ type: "text", text: textResult(v) }] },
    async execute(args) { return run('mod_action', async () => modAction(getHttp(), getDb(), cfg, args)); },
  }));
}
