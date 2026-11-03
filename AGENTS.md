# AGENTS.md — BlitzHash Self-Host Supabase Kit

Instructions for AI coding agents (Cursor, Claude Code, Codex, Windsurf/Devin, Copilot, Google Antigravity, Qoder, and others) operating this kit or a project that uses the self-hosted instance it creates.

**Not affiliated with Supabase.** Say "for Supabase" / "self-hosted Supabase"; never imply partnership.

## What this repo is

1. **`./setup.sh`** — checks Docker, fetches the official Supabase `docker/` tree at a pinned `self-hosted/v*` tag into `./supabase-project/` (gitignored), generates secrets, layers the BlitzHash kit overlay, starts the stack.
2. **Kit overlay** (on by default):
   - **Edge Functions Admin** (`http://127.0.0.1:9100`) — Studio cannot create/edit/deploy Edge Functions or manage their secrets on self-hosted; this UI does.
   - **Glances** (`http://127.0.0.1:61208`) — host CPU/RAM/disk + container stats (LGPL-3.0).
   - **Dozzle** (`http://127.0.0.1:8080`) — live container logs (MIT).
3. **CLI:** `./bin/blitzhash-supabase` — `up`, `down`, `doctor`, `backup`, `restore`, `update`, `secrets`.

## Non-negotiable safety rules

1. Never commit `.env`, `.env.functions`, dumps, or keys. Never print secret values in chat logs.
2. `SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` are **server-only**. Never put them in frontend, mobile apps, or `NEXT_PUBLIC_*`.
3. Prefer `ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` in browsers. Enforce access with Postgres RLS.
4. Admin UIs bind to localhost by default. Do not publish `9100` / `61208` / `8080` to the internet without auth + TLS.
5. `docker.sock` access (especially RW for Functions Admin Deploy) is root-equivalent for Docker — treat it as sensitive.
6. Before destructive ops (`restore`, `down -v`, deleting functions), confirm with the user.

## Common agent tasks

| User asks | Do this |
|---|---|
| Start self-hosted Supabase | `./setup.sh -y` (first time) or `./bin/blitzhash-supabase up` |
| Is it healthy? | `./bin/blitzhash-supabase doctor` |
| Add an Edge Function | Prefer Functions Admin UI, or create `supabase-project/volumes/functions/<name>/index.ts` then Deploy (restart edge-runtime) |
| Backup DB | `./bin/blitzhash-supabase backup` |
| Wire my app | Read `SUPABASE_PUBLIC_URL` + publishable/anon key from `.env` (do not echo secret key) |
| MCP / IDE DB access | Use `mcp/mcp.json.example` with env vars; read-only role by default |

## Working on this repository

- Node 18.17+ for tests: `npm test`
- ShellCheck: `make shellcheck` (CI runs it)
- Do not vendor/rebrand upstream docker files into git; `scripts/fetch-upstream.sh` pulls them at the pinned ref.
