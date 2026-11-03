#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
check_docker
REF="${1:-$UPSTREAM_REF}"
info "Updating official docker files to $REF (keeps .env and data volumes)"
"$KIT_ROOT/scripts/fetch-upstream.sh" "$REF"
# Re-copy kit overlay pieces that we own
mkdir -p "$PROJECT_DIR/kit" "$PROJECT_DIR/volumes/kit"
rm -rf "$PROJECT_DIR/kit/functions-admin" && mkdir -p "$PROJECT_DIR/kit" && cp -a "$KIT_ROOT/services/functions-admin" "$PROJECT_DIR/kit/functions-admin"
cp "$KIT_ROOT/overlays/docker-compose.kit.yml" "$PROJECT_DIR/docker-compose.kit.yml"
cp "$KIT_ROOT/overlays/glances.conf" "$PROJECT_DIR/volumes/kit/glances.conf"
in_project docker compose pull || true
in_project docker compose build functions-admin
in_project docker compose up -d
ok "Update applied. Run: ./bin/blitzhash-supabase doctor"
