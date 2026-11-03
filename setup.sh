#!/usr/bin/env bash
# BlitzHash Self-Host Supabase Kit — one-command setup.
# Fetches official Supabase docker/ at a pinned tag, generates secrets, layers
# kit overlays (Edge Functions Admin + Glances + Dozzle), starts the stack.
#
# Not affiliated with Supabase. Upstream: Apache-2.0.
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "$KIT_ROOT/scripts/lib/common.sh"

SKIP_START=0
ASSUME_YES=0
export ASSUME_YES
PUBLIC_URL="${SUPABASE_PUBLIC_URL:-http://localhost:8000}"

usage() {
  cat <<USAGE
Usage: ./setup.sh [options]

  --ref <tag>          Upstream git ref (default: $UPSTREAM_REF)
  --project-dir <dir>  Project directory (default: ./supabase-project)
  --public-url <url>   SUPABASE_PUBLIC_URL (default: http://localhost:8000)
  --skip-start         Fetch + secrets only; do not docker compose up
  -y, --yes            Non-interactive
  -h, --help           Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) UPSTREAM_REF="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --public-url) PUBLIC_URL="$2"; shift 2 ;;
    --skip-start) SKIP_START=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

export BLITZHASH_SUPABASE_DIR="$PROJECT_DIR"
export BLITZHASH_UPSTREAM_REF="$UPSTREAM_REF"

info "BlitzHash Self-Host Supabase Kit"
[[ "$ASSUME_YES" == "1" ]] && info "Non-interactive mode (-y)"
info "Upstream pin: $UPSTREAM_REF"
info "Project dir:  $PROJECT_DIR"

require_cmd git
require_cmd openssl
require_cmd node
check_docker

"$KIT_ROOT/scripts/fetch-upstream.sh" "$UPSTREAM_REF"

# Seed .env from upstream example if missing
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
fi

# URLs
set_kv() {
  local file="$1" k="$2" v="$3"
  if grep -q "^${k}=" "$file"; then
    awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k {$0=k"="v} {print}' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  else
    printf '%s=%s\n' "$k" "$v" >> "$file"
  fi
}

set_kv "$PROJECT_DIR/.env" SUPABASE_PUBLIC_URL "$PUBLIC_URL"
set_kv "$PROJECT_DIR/.env" API_EXTERNAL_URL "${PUBLIC_URL%/}/auth/v1"
# SITE_URL may already exist in .env.example under Auth section
if grep -q '^SITE_URL=' "$PROJECT_DIR/.env"; then
  set_kv "$PROJECT_DIR/.env" SITE_URL "${SITE_URL:-http://localhost:3000}"
fi

# Generate secrets via upstream scripts (preferred)
info "Generating secrets"
(
  cd "$PROJECT_DIR"
  if [[ -f utils/generate-keys.sh ]]; then
    sh utils/generate-keys.sh --update-env
  fi
  if [[ -f utils/add-new-auth-keys.sh ]]; then
    sh utils/add-new-auth-keys.sh --update-env
  fi
)

# Copy kit overlay + functions-admin sources into project
mkdir -p "$PROJECT_DIR/kit" "$PROJECT_DIR/volumes/kit" "$PROJECT_DIR/backups"
rm -rf "$PROJECT_DIR/kit/functions-admin" && mkdir -p "$PROJECT_DIR/kit" && cp -a "$KIT_ROOT/services/functions-admin" "$PROJECT_DIR/kit/functions-admin"
cp "$KIT_ROOT/overlays/docker-compose.kit.yml" "$PROJECT_DIR/docker-compose.kit.yml"
cp "$KIT_ROOT/overlays/glances.conf" "$PROJECT_DIR/volumes/kit/glances.conf"
cp "$KIT_ROOT/overlays/THIRD_PARTY_NOTICES" "$PROJECT_DIR/volumes/kit/THIRD_PARTY_NOTICES"
cp "$KIT_ROOT/overlays/Caddyfile.functions-admin.snippet" "$PROJECT_DIR/volumes/kit/Caddyfile.functions-admin.snippet"

# Ensure .env.functions exists (gitignored via volumes; create empty)
touch "$PROJECT_DIR/volumes/functions/.env.functions"
chmod 600 "$PROJECT_DIR/volumes/functions/.env.functions" || true

# Layer kit compose file
COMPOSE_FILE="$(grep '^COMPOSE_FILE=' "$PROJECT_DIR/.env" | cut -d= -f2- || true)"
if [[ -z "$COMPOSE_FILE" ]]; then
  COMPOSE_FILE="docker-compose.yml"
fi
case ":$COMPOSE_FILE:" in
  *:docker-compose.kit.yml:*) ;;
  *)
    COMPOSE_FILE="${COMPOSE_FILE}:docker-compose.kit.yml"
    set_kv "$PROJECT_DIR/.env" COMPOSE_FILE "$COMPOSE_FILE"
    ;;
esac

# Bind defaults for admin UIs
grep -q '^FUNCTIONS_ADMIN_BIND=' "$PROJECT_DIR/.env" || echo 'FUNCTIONS_ADMIN_BIND=127.0.0.1' >> "$PROJECT_DIR/.env"
grep -q '^GLANCES_BIND=' "$PROJECT_DIR/.env" || echo 'GLANCES_BIND=127.0.0.1' >> "$PROJECT_DIR/.env"
grep -q '^DOZZLE_BIND=' "$PROJECT_DIR/.env" || echo 'DOZZLE_BIND=127.0.0.1' >> "$PROJECT_DIR/.env"

# Studio companion note (honest about linking)
mkdir -p "$PROJECT_DIR/volumes/kit"
cat > "$PROJECT_DIR/volumes/kit/STUDIO_LINKS.md" <<'NOTE'
# Companion UIs (BlitzHash kit)

Self-hosted Supabase Studio cannot create/edit/deploy Edge Functions or manage
their secrets. Use:

- Edge Functions Admin: http://127.0.0.1:9100  (Basic auth = Studio credentials)
- Glances health:       http://127.0.0.1:61208
- Dozzle logs:          http://127.0.0.1:8080

Studio does not expose a supported hook for injecting a first-party nav item
without forking Studio. Keep this bookmark, or optionally reverse-proxy
`/functions-admin` with the Caddy snippet in this folder.
NOTE

if [[ "$SKIP_START" = "1" ]]; then
  ok "Fetched and configured (skipped start)"
  exit 0
fi

info "Pulling images + building functions-admin"
in_project docker compose pull || true
in_project docker compose build functions-admin

info "Starting stack (includes kit health + functions-admin by default)"
if [[ -f "$PROJECT_DIR/run.sh" ]]; then
  in_project sh run.sh start
else
  in_project docker compose up -d --wait || in_project docker compose up -d
fi

# Print summary (mask secrets)
# shellcheck disable=SC1091
set -a; source "$PROJECT_DIR/.env"; set +a
DASH_USER="${DASHBOARD_USERNAME:-supabase}"

cat <<SUMMARY

────────────────────────────────────────────────────────────
 Self-hosted Supabase is starting
────────────────────────────────────────────────────────────
 Studio / API:     ${SUPABASE_PUBLIC_URL:-http://localhost:8000}
  user:            ${DASH_USER}
  password:        (see supabase-project/.env → DASHBOARD_PASSWORD)

 Edge Functions Admin:  http://127.0.0.1:9100
 Host health (Glances): http://127.0.0.1:${GLANCES_PORT:-61208}
 Container logs (Dozzle): http://127.0.0.1:${DOZZLE_PORT:-8080}

 Publishable key:  (SUPABASE_PUBLISHABLE_KEY or ANON_KEY in .env)
 Secret key:       SERVER ONLY — never put in frontend

 Commands:
   make doctor | ./bin/blitzhash-supabase doctor
   make backup | ./bin/blitzhash-supabase backup
   make down   | ./bin/blitzhash-supabase down

 Not affiliated with Supabase. Free assessment: https://blitzhash.com
────────────────────────────────────────────────────────────
SUMMARY
