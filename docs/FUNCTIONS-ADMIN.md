# Edge Functions Admin

Self-hosted **Supabase Studio cannot create, edit, deploy, or manage secrets**
for Edge Functions. The BlitzHash Functions Admin fills that gap.

## What it does

- Lists folders under `volumes/functions` (skips editing the reserved `main` runtime entry)
- Create / edit (CodeMirror) / delete function `index.ts` files
- **Deploy / reload** restarts the `supabase-edge-functions` container via the Docker API
- Manages secrets in `volumes/functions/.env.functions` — values **masked in UI**, never logged, file mode `0600`

## Auth

HTTP Basic Auth. Credentials:

1. `FUNCTIONS_ADMIN_USERNAME` / `FUNCTIONS_ADMIN_PASSWORD` if set, else
2. Studio `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`

## Linking from Studio (honest notes)

Studio does **not** ship a supported extension point for a first-party nav item
on self-hosted without forking the Studio image. The kit therefore:

1. Prints the Functions Admin URL after `./setup.sh`
2. Writes `supabase-project/volumes/kit/STUDIO_LINKS.md`
3. Ships an optional Caddy snippet so you can serve `/functions-admin` on the
   same HTTPS domain as Studio (`overlays/Caddyfile.functions-admin.snippet`)

Default URL: **http://127.0.0.1:9100**

## Docker socket

Deploy needs a **read-write** docker.sock mount to call
`POST /containers/supabase-edge-functions/restart`. That is equivalent to local
root for Docker. Bind the port to localhost and restrict who can auth.
