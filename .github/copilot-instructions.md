Follow AGENTS.md in the repository root.

This kit wraps the official Supabase Docker self-host (Apache-2.0 upstream, fetched at a pinned tag). BlitzHash adds Edge Functions Admin, Glances, Dozzle, and IDE rules. Not affiliated with Supabase.

Never commit `.env` or `.env.functions`. Never place SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY in frontend code. Prefer RLS with the anon/publishable key.
