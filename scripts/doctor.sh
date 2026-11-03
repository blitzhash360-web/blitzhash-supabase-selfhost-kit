#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"
check_docker
ensure_project

info "Compose services"
in_project docker compose ps || true

fail=0
check_http() {
  local name="$1" url="$2"
  if curl -fsS -o /dev/null --max-time 5 "$url"; then
    ok "$name ($url)"
  else
    echo "FAIL: $name ($url)" >&2
    fail=1
  fi
}

# Gateway may require auth; just check TCP via compose
info "Kit companion ports (localhost binds)"
check_http "Functions Admin" "http://127.0.0.1:${FUNCTIONS_ADMIN_PORT:-9100}/" || true
# Basic auth will 401 — treat 401 as up
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${FUNCTIONS_ADMIN_PORT:-9100}/" || echo 000)
if [[ "$code" == "401" || "$code" == "200" ]]; then ok "Functions Admin HTTP $code"; else echo "WARN: Functions Admin HTTP $code"; fail=1; fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${GLANCES_PORT:-61208}/" || echo 000)
if [[ "$code" == "200" || "$code" == "401" ]]; then ok "Glances HTTP $code"; else echo "WARN: Glances HTTP $code"; fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${DOZZLE_PORT:-8080}/" || echo 000)
if [[ "$code" == "200" || "$code" == "401" ]]; then ok "Dozzle HTTP $code"; else echo "WARN: Dozzle HTTP $code"; fi

# Validate JWT if present
if [[ -f "$PROJECT_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$PROJECT_DIR/.env"; set +a
  if [[ -n "${JWT_SECRET:-}" && -n "${ANON_KEY:-}" ]]; then
    if node "$KIT_ROOT/scripts/lib/jwt.mjs" verify "$ANON_KEY" "$JWT_SECRET" >/dev/null; then
      ok "ANON_KEY signature verifies"
    else
      echo "FAIL: ANON_KEY does not verify against JWT_SECRET" >&2
      fail=1
    fi
  fi
fi

[[ "$fail" = "0" ]] && ok "doctor finished" || exit 1
