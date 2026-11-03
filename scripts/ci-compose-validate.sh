#!/usr/bin/env bash
# Validate kit overlay YAML + JWT generation without needing a running Docker daemon.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> JWT generate + verify"
json="$(node scripts/lib/jwt.mjs gen)"
secret="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).JWT_SECRET)" "$json")"
anon="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).ANON_KEY)" "$json")"
service="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).SERVICE_ROLE_KEY)" "$json")"
node scripts/lib/jwt.mjs verify "$anon" "$secret" >/dev/null
node scripts/lib/jwt.mjs verify "$service" "$secret" >/dev/null
node -e '
import { verifyHs256 } from "./scripts/lib/jwt.mjs";
const secret=process.argv[1], anon=process.argv[2], svc=process.argv[3];
const a=verifyHs256(anon,secret), s=verifyHs256(svc,secret);
if(!a.ok||a.payload.role!=="anon") throw new Error("anon bad");
if(!s.ok||s.payload.role!=="service_role") throw new Error("service bad");
console.log("JWT ok");
' "$secret" "$anon" "$service"

echo "==> Overlay YAML present"
test -f overlays/docker-compose.kit.yml
test -f overlays/glances.conf
test -f services/functions-admin/server.mjs
test -f services/functions-admin/Dockerfile

echo "==> Compose config via docker (optional)"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  # Minimal stub project to validate kit overlay merges
  mkdir -p "$tmp"
  printf 'services:\n  functions:\n    image: alpine:3.20\n    command: ["sleep","3600"]\n' > "$tmp/docker-compose.yml"
  cp overlays/docker-compose.kit.yml "$tmp/docker-compose.kit.yml"
  mkdir -p "$tmp/kit/functions-admin" "$tmp/volumes/functions" "$tmp/volumes/kit"
  cp -a services/functions-admin "$tmp/kit/functions-admin"
  cp overlays/glances.conf "$tmp/volumes/kit/glances.conf"
  printf 'DASHBOARD_USERNAME=supabase\nDASHBOARD_PASSWORD=testdashboardpass1\n' > "$tmp/.env"
  (cd "$tmp" && docker compose -f docker-compose.yml -f docker-compose.kit.yml config >/dev/null)
  echo "compose config ok"
  rm -rf "$tmp"
else
  echo "docker unavailable — skipped compose config validation"
  # Still parse YAML-ish: require key services
  grep -q 'functions-admin:' overlays/docker-compose.kit.yml
  grep -q 'glances:' overlays/docker-compose.kit.yml
  grep -q 'dozzle:' overlays/docker-compose.kit.yml
fi

echo "==> Fetch-upstream dry check (network)"
# Ensure the pinned ref exists
code=$(curl -s -o /dev/null -w '%{http_code}' "https://github.com/supabase/supabase/tree/${BLITZHASH_UPSTREAM_REF:-self-hosted/v0.8.3}/docker")
[[ "$code" == "200" ]] || { echo "upstream ref page HTTP $code"; exit 1; }
echo "upstream ref reachable"

echo "ci-compose-validate ok"
