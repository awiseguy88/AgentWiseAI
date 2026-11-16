# AgentWiseAI — MCP server for local Lemonade image generation + social posts

An [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that:

1. **Generates images** via your local [Lemonade](https://lemonade.ai) server (`lemonade_health`, `generate_image`, `list_images`)
2. **Prepares platform-ready social posts** (caption, alt text, hashtags, image validation) (`prepare_social_post`)
3. **Publishes** to enabled platforms only when explicitly confirmed and enabled (`publish_social_post`, dry-run by default)

## Repository layout

```
src/
  server.ts          MCP stdio entrypoint
  config.ts          env-driven configuration
  lemonade/
    types.ts         assumed Lemonade API contract
    client.ts        HTTP client + sync/async generation + local save
  storage/
    assets.ts        local image + metadata sidecar store
  social/
    base.ts          adapter interface + constraint registry
    x.ts             starter X/Twitter adapter (template, not live)
  tools/             MCP tool schemas + handlers
outputs/             generated images + .meta.json sidecars (gitignored)
docs/
  lemonade-api.md    TBD — capture your Lemonade API here
  social-platforms.md TBD — per-platform posting notes
```

## Prerequisites

- Node.js ≥ 20
- A running local Lemonade server (default `http://127.0.0.1:8000`)

## Install

```bash
cd AgentWiseAI/mcp-lemonade-server
cp .env.example .env
# edit .env to point LEMONADE_BASE_URL at your server
npm install
```

## Run

```bash
# dev mode (tsx, no build step)
npm run dev

# or build then run
npm run build
npm start
```

The server speaks stdio, so wire it into your MCP client. Example Claude Desktop
`claude_desktop_config.json` entry:

```json
{
  "mcpServers": {
    "agentwiseai": {
      "command": "node",
      "args": ["/absolute/path/to/AgentWiseAI/mcp-lemonade-server/dist/server.js"],
      "env": {
        "LEMONADE_BASE_URL": "http://127.0.0.1:8000",
        "OUTPUT_DIR": "/absolute/path/to/AgentWiseAI/mcp-lemonade-server/outputs"
      }
    }
  }
}
```

## MCP tools

| Tool | Purpose |
|---|---|
| `lemonade_health` | Verify Lemonade is reachable |
| `generate_image` | `prompt`, optional `size`/`model`/`seed`/`count` → saved local images |
| `list_images` | List recent generated assets with metadata |
| `prepare_social_post` | Package caption + image for a platform; validates length/format |
| `publish_social_post` | Publish (dry-run unless `confirm: true` and platform enabled) |

## Social posting (v0.1)

Publishing is **disabled by default** and defaults to dry-run. To enable a
platform:

1. Implement its adapter in `src/social/` (see `src/social/x.ts` as a template)
2. Add it to `SOCIAL_ENABLED_PLATFORMS` in `.env`
3. Call `publish_social_post` with `confirm: true`

Until then, use `prepare_social_post` to get validation + platform-ready copy
without touching any social API.

## What still needs your input (blocking full implementation)

- **Lemonade API shape:** confirm the generate endpoint, request/response fields, auth, and whether generation is synchronous or async/job-based. See `docs/lemonade-api.md` (template) — fill in from your server's docs/`curl` output.
- **Social targets:** which platforms to support first (X, LinkedIn, Instagram, Mastodon, …) and whether v0.1 should be generate+prepare-only or include live publishing.
- **Image output:** confirm `outputs/` is the right place, or set `OUTPUT_DIR`.

## License

Private / internal.
