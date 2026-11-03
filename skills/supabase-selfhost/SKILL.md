---
name: supabase-selfhost
description: Operate BlitzHash Self-Host Supabase Kit — one-command official Docker self-host, Edge Functions Admin (Studio cannot manage functions on self-hosted), Glances/Dozzle health, backup/restore, and safe IDE/MCP wiring. Use when the user asks to self-host Supabase, manage Edge Functions locally, or check container health.
---

# Supabase self-host (BlitzHash kit)

Not affiliated with Supabase. Commands assume a clone of `blitzhash-supabase-selfhost-kit`.

## Setup

```bash
./setup.sh -y
# or: make setup
```

Fetches official `supabase/supabase` `docker/` at pin `self-hosted/v0.8.3` (override with `--ref`), generates secrets via upstream `utils/generate-keys.sh` + `add-new-auth-keys.sh`, starts stack + kit overlay.

## Day-2

```bash
./bin/blitzhash-supabase doctor
./bin/blitzhash-supabase backup
./bin/blitzhash-supabase update
./bin/blitzhash-supabase down
```

## Edge Functions (important)

Self-hosted Studio **cannot** create/edit/deploy functions or manage their secrets. Use:

- UI: `http://127.0.0.1:9100` (Basic auth = Studio dashboard credentials)
- Files: `supabase-project/volumes/functions/<name>/index.ts`
- Secrets file: `supabase-project/volumes/functions/.env.functions` (masked in UI; never commit)
- Deploy button restarts `supabase-edge-functions` via Docker API

## Health (on by default)

- Glances: `http://127.0.0.1:61208`
- Dozzle: `http://127.0.0.1:8080`

## Safety

- Never commit `.env` or put `SERVICE_ROLE_KEY` in frontend
- Keep admin ports on localhost
- Confirm before `restore` or deleting functions
