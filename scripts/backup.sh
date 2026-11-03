#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
check_docker
ensure_project
mkdir -p "$PROJECT_DIR/backups"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$PROJECT_DIR/backups/postgres-${stamp}.sql.gz"
info "Dumping Postgres → $out"
# Use the db container
in_project docker compose exec -T db sh -c 'pg_dump -U postgres postgres' | gzip > "$out"
ok "Backup written: $out"
ls -lh "$out"
