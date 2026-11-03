# Going to production

This kit gets you a working self-hosted Supabase with companion UIs. A production
deployment for a real business still needs work beyond `./setup.sh`.

## HTTPS reverse proxy

Prefer the official overlay:

```bash
cd supabase-project
# see upstream docs: docker-compose.caddy.yml
sh run.sh config add caddy   # if available in your pin
# set PROXY_DOMAIN=your.domain in .env
```

Optional: paste `volumes/kit/Caddyfile.functions-admin.snippet` so
`https://your.domain/functions-admin` reaches the Edge Functions Admin.

## Firewall tips

- Default kit binds Functions Admin, Glances, and Dozzle to **127.0.0.1** only.
- Keep Postgres port closed to the world; use the pooler / API gateway.
- Allow 80/443 (or your proxy) only. SSH from your IP.
- `docker.sock` inside admin containers is powerful — treat host access as root.

## SMTP

Set in `supabase-project/.env` (official Auth vars):

```
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
SMTP_SENDER_NAME=Your App
```

Then `sh run.sh recreate` (or `docker compose up -d --force-recreate`).

## Backups

`./bin/blitzhash-supabase backup` writes a local `pg_dump`. For production:

- Copy dumps **off-box** (S3/R2/another region).
- Test `restore` on a staging box before you need it.
- Snapshot Docker volumes for Storage too.

## What this kit does not cover

High availability, multi-node Postgres, advanced WAF, paging/on-call monitoring,
cost tuning, and security hardening beyond defaults. Free assessment:
https://blitzhash.com
