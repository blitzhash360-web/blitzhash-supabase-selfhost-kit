# MCP config (self-hosted)

Copy `mcp/mcp.json.example` into your IDE's MCP settings. Use **env vars**, never
hard-coded secrets. Prefer a **read-only** database role for exploration.

See also: official Supabase MCP and community Postgres MCP servers. Point them at
your self-hosted URL / Postgres pooler, not Supabase Cloud, when working locally.
