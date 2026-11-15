# dsh-reddit-suite (DeepSeek Harness / Cordis host plugin)

A host plugin bundle for the DeepSeek Harness (DSH) that lets the agent use Reddit via **session cookie** and/or **OAuth**, with:

- Subreddit/listing browsing and post+comment reading
- **Full recursive expansion** of comment `more` continuations (bounded by safety caps)
- Automated **login attempt** flow with CAPTCHA/challenge detection and hook/manual continuation (no built-in autonomous CAPTCHA solving)
- **OAuth** app flow helpers (authorize URL, code exchange, refresh)
- **Gated** write/vote/moderation actions (disabled by default; require enablement + explicit confirm; dry-run supported)
- Local **SQLite** database (`node:sqlite`) storing subreddits, posts, comments, expansion state, fetch/action audits, and (optionally) persisted tokens

## Install

From this workspace (current Harness profile), install the bundle directory with `plugin_manager`:

- `action: install_bundle`
- `target: /data/github-agent/state/agentwiseai/dsh-reddit-suite`

Then configure the plugin row `dsh-reddit-suite` in the profile/plugin config.

## Configuration (key fields)

- `authMode`: `"session_cookie" | "oauth" | "auto"` (default `auto`)
- `cookie`: full Reddit web `Cookie` header value for session-cookie auth (e.g. `reddit_session=...; token_v2=...`). **Secret** — never echoed by tools.
- `userAgent`: descriptive User-Agent string (set a real one; Reddit requires identification).
- `baseUrl`: default `https://www.reddit.com`
- `oauthBaseUrl`: default `https://oauth.reddit.com`
- `dbPath`: SQLite path (absolute or relative). Default: `<workspace-or-profile-data>/reddit-suite.sqlite` resolved at runtime.
- `requestTimeoutMs`, `minIntervalMs`, `maxRetries`, `retryBackoffMs`: HTTP behavior/rate limiting.
- `maxMoreBatches`, `maxMoreChildren`, `maxCommentDepth`, `maxItemsPerCall`: safety caps for recursive `more` expansion and listing reads.
- `storeRawJson`: store raw API JSON blobs (default `true`).
- `enableWriteActions`: `false` by default. Must be `true` for write/vote/mod tools, and each call must pass `confirm: true`.
- `oauth`: `{ clientId, clientSecret, redirectUri, scope, duration, accessToken, refreshToken, tokenExpiry }` — provide what your app flow needs.
- `login`: `{ username, password, otp, captchaSolver }` — optional; prefer ephemeral per-call secrets. `captchaSolver` is an optional hook config for an external solver service (generic HTTP interface) if you provide one.
- `captchaSolver` (top-level or under login): `{ type: "http", url, method, apiKey, requestTemplate }` shape as implemented — see tool docs/errors for exact fields.

## Tools (summary)

**Read / DB**
- `reddit_browse_subreddit` — list/browse subreddit feed (hot/new/top/rising), store to DB.
- `reddit_get_post` — fetch post + comments and **recursively expand all `more`** continuations (within caps), store to DB.
- `reddit_expand_more` — explicitly expand pending `more` nodes for a stored/fetched post.
- `reddit_db_stats` — DB counts, path, recent audit.
- `reddit_db_query_posts` / `reddit_db_query_comments` — read-only DB queries/search.

**Auth / OAuth / login**
- `reddit_oauth_begin` — generate authorize URL for code-paste flow.
- `reddit_oauth_exchange` — exchange code for tokens (optionally persist).
- `reddit_oauth_refresh` — refresh access token.
- `reddit_login` — attempt web login; detects and returns CAPTCHA/challenge details when present.
- `reddit_submit_login_challenge` — submit external/manual CAPTCHA/solution or invoke configured solver hook, then continue login.
- `reddit_auth_status` — report available auth state (no secrets).

**Write / vote / moderation (gated)**
- `reddit_submit_post`, `reddit_submit_comment`, `reddit_edit`, `reddit_delete`, `reddit_vote`, `reddit_mod_action`
- Require `enableWriteActions=true` and `confirm:true`; support `dryRun` where applicable. Actions are audited in DB.

## Login, CAPTCHA, and feasibility notes

- Automated login performs a programmatic login handshake using supplied credentials.
- **CAPTCHA/autonomous solving is not built in.** If Reddit presents a CAPTCHA or challenge, `reddit_login` returns structured challenge info. You can resolve it out-of-band and continue with `reddit_submit_login_challenge` (supplying the response/token), or configure/provide an external solver hook if available. End-to-end automation without such input is not guaranteed.
- OAuth flows implemented here are non-GUI (authorize URL + manual code paste / exchange). Provide `clientId`, `clientSecret` (as required), `redirectUri`, and scopes.

## Recursive `more` expansion

- Expansion fetches comment continuations in batches and recurses until no pending `more` nodes remain or configured safety caps are hit.
- Results include expansion stats and whether expansion was complete or capped/partial. Increase caps cautiously to avoid rate limits and very large threads.

## Database

- SQLite file at `dbPath` (default resolved at runtime). Schema is versioned/migrated automatically.
- Tables include `subreddits`, `posts`, `comments`, `more_nodes`, `fetch_audit`, `action_audit`, `oauth_tokens`, `meta`.
- `raw_json` stored when enabled. Treat the DB as sensitive local data.

## Safety and limitations

- Secrets (cookie, passwords, tokens, API keys) are redacted from tool outputs/errors.
- Rate limiting/backoff is applied, but you are responsible for compliant use and account security.
- Reddit endpoint shapes and anti-abuse responses vary; tools surface HTTP/status details and store raw payloads where possible.
- Network/runtime verification may be environment-dependent (some hosts/networks are blocked by Reddit without valid auth).
- This bundle does not spawn browsers or include a CAPTCHA-solving service.

## Verification notes

Static checks: `node --check` on all `.js` modules and JSON/YAML validation. Runtime install/activation and live Reddit calls depend on Harness tool approvals and valid credentials/network access.
