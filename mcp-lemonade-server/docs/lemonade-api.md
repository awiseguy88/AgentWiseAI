# Lemonade API

## Base URL
- **LAN (local):** `http://192.168.12.174:13305` (provided)
- **Remote access:** expose via Cloudflare Tunnel and set `LEMONADE_BASE_URL` to the tunnel URL (e.g. `https://<subdomain>.trycloudflare.com`) so this environment/client can reach it.

> Note: the LAN address is not reachable from this hosted workspace; API discovery/mapping will be completed once a reachable tunnel URL (or API docs/sample `curl`) is provided.

## Auth
None / API key (`LEMONADE_API_KEY`) / other: _TBD_

## Endpoints (to confirm from live server/docs)

### Health
`GET /health` (assumed) → _TBD_

### Generate (sync or async)
`POST /generate` (assumed) → _TBD_
- Request body fields: `prompt`, `negative_prompt`, `size`, `model`, `seed`, `count`, …
- Response fields: `images` (URLs or base64), `jobId`, `pending`, …

### Job status (if async)
`GET /jobs/:id` (assumed) → _TBD_

## Output mode
- [ ] Server returns base64 data URIs
- [ ] Server returns image URLs to download
- [ ] Server writes files to disk (path?)

## Discovery checklist (once reachable)
```bash
curl -s $LEMONADE_BASE_URL/
curl -s $LEMONADE_BASE_URL/health
curl -s $LEMONADE_BASE_URL/v1/models
# capture a real generate request/response:
curl -s -X POST $LEMONADE_BASE_URL/<generate-endpoint> \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a red fox in watercolor"}'
```
