# AI IDE integration

| IDE | What to use |
|---|---|
| Any / Codex / Windsurf / Copilot | Root [`AGENTS.md`](../AGENTS.md) |
| Claude Code | [`CLAUDE.md`](../CLAUDE.md) + [`skills/supabase-selfhost/SKILL.md`](../skills/supabase-selfhost/SKILL.md) (copy into `~/.claude/skills/`) |
| Cursor | [`.cursor/rules/*.mdc`](../.cursor/rules/) |
| Windsurf / Devin Desktop | [`.windsurf/rules/`](../.windsurf/rules/) and [`.devin/rules/`](../.devin/rules/) (both shipped; AGENTS.md fallback) |
| GitHub Copilot | [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) |
| Google Antigravity | Root `AGENTS.md` + [`.agents/rules/*.md`](../.agents/rules/) |
| Qoder | Root `AGENTS.md` + [`.qoder/rules/*.md`](../.qoder/rules/) |

MCP example (read-only Postgres by default): [`mcp/mcp.json.example`](../mcp/mcp.json.example)

Never commit `.env`. Never put `SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` in frontend code.
