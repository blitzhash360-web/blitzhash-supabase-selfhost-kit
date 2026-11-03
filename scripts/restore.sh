#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
file="${1:-}"
[[ -n "$file" ]] || die "usage: restore <dump.sql.gz|dump.sql>"
[[ -f "$file" ]] || die "file not found: $file"
check_docker
ensure_project
info "Restoring $file into db (destructive to existing data in public schemas as dumped)"
if [[ "$file" == *.gz ]]; then
  gzip -dc "$file" | in_project docker compose exec -T db sh -c 'psql -U postgres -d postgres'
else
  in_project docker compose exec -T db sh -c 'psql -U postgres -d postgres' < "$file"
fi
ok "Restore finished"
