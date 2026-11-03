#!/usr/bin/env bash
# Generate strong secrets for a fetched official Supabase docker project.
# Prefers upstream utils/generate-keys.sh + add-new-auth-keys.sh when present.
# Falls back to local Node JWT helper for the legacy HS256 keys + openssl for the rest.
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

UPDATE_ENV=0
for arg in "$@"; do
  case "$arg" in
    --update-env) UPDATE_ENV=1 ;;
    -h|--help)
      echo "Usage: scripts/gen-secrets.sh [--update-env]"
      exit 0
      ;;
  esac
done

ensure_project
require_cmd openssl
require_cmd node

cd "$PROJECT_DIR"

if [[ -x utils/generate-keys.sh || -f utils/generate-keys.sh ]]; then
  info "Using upstream utils/generate-keys.sh"
  if [[ "$UPDATE_ENV" = "1" ]]; then
    sh utils/generate-keys.sh --update-env
  else
    sh utils/generate-keys.sh
  fi
  if [[ -f utils/add-new-auth-keys.sh ]]; then
    info "Using upstream utils/add-new-auth-keys.sh (asymmetric + opaque keys)"
    if [[ "$UPDATE_ENV" = "1" ]]; then
      sh utils/add-new-auth-keys.sh --update-env
    else
      sh utils/add-new-auth-keys.sh
    fi
  fi
  exit 0
fi

info "Upstream key scripts missing; using kit fallback generator"
KIT_JWT="$KIT_ROOT/scripts/lib/jwt.mjs"
json="$(node "$KIT_JWT" gen)"
jwt_secret="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(j.JWT_SECRET)" "$json")"
anon_key="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(j.ANON_KEY)" "$json")"
service_key="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(j.SERVICE_ROLE_KEY)" "$json")"

postgres_password="$(openssl rand -hex 16)"
# Dashboard password: letters+numbers only (upstream Studio basic-auth constraint)
dashboard_password="$(openssl rand -hex 12)"
secret_key_base="$(openssl rand -base64 48)"
realtime_db_enc_key="$(openssl rand -hex 8)"
vault_enc_key="$(openssl rand -hex 16)"
pg_meta_crypto_key="$(openssl rand -base64 24)"
logflare_public="$(openssl rand -base64 24)"
logflare_private="$(openssl rand -base64 24)"
s3_id="$(openssl rand -hex 16)"
s3_secret="$(openssl rand -hex 32)"
minio_pw="$(openssl rand -hex 16)"

cat <<OUT
JWT_SECRET=${jwt_secret}
ANON_KEY=${anon_key}
SERVICE_ROLE_KEY=${service_key}
POSTGRES_PASSWORD=${postgres_password}
DASHBOARD_PASSWORD=${dashboard_password}
SECRET_KEY_BASE=${secret_key_base}
REALTIME_DB_ENC_KEY=${realtime_db_enc_key}
VAULT_ENC_KEY=${vault_enc_key}
PG_META_CRYPTO_KEY=${pg_meta_crypto_key}
LOGFLARE_PUBLIC_ACCESS_TOKEN=${logflare_public}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${logflare_private}
S3_PROTOCOL_ACCESS_KEY_ID=${s3_id}
S3_PROTOCOL_ACCESS_KEY_SECRET=${s3_secret}
MINIO_ROOT_PASSWORD=${minio_pw}
OUT

if [[ "$UPDATE_ENV" = "1" ]]; then
  [[ -f .env ]] || cp .env.example .env
  set_kv() {
    local k="$1" v="$2"
    if grep -q "^${k}=" .env; then
      # portable in-place replace
      awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k {$0=k"="v} {print}' .env > .env.tmp && mv .env.tmp .env
    else
      printf '%s=%s\n' "$k" "$v" >> .env
    fi
  }
  set_kv JWT_SECRET "$jwt_secret"
  set_kv ANON_KEY "$anon_key"
  set_kv SERVICE_ROLE_KEY "$service_key"
  set_kv POSTGRES_PASSWORD "$postgres_password"
  set_kv DASHBOARD_PASSWORD "$dashboard_password"
  set_kv SECRET_KEY_BASE "$secret_key_base"
  set_kv REALTIME_DB_ENC_KEY "$realtime_db_enc_key"
  set_kv VAULT_ENC_KEY "$vault_enc_key"
  set_kv PG_META_CRYPTO_KEY "$pg_meta_crypto_key"
  set_kv LOGFLARE_PUBLIC_ACCESS_TOKEN "$logflare_public"
  set_kv LOGFLARE_PRIVATE_ACCESS_TOKEN "$logflare_private"
  set_kv S3_PROTOCOL_ACCESS_KEY_ID "$s3_id"
  set_kv S3_PROTOCOL_ACCESS_KEY_SECRET "$s3_secret"
  set_kv MINIO_ROOT_PASSWORD "$minio_pw"
  ok "Wrote secrets into $PROJECT_DIR/.env"
fi
