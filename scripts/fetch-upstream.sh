#!/usr/bin/env bash
# Sparse-clone official Supabase docker/ at a pinned self-hosted tag into PROJECT_DIR.
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

require_cmd git
require_cmd curl

REF="${1:-$UPSTREAM_REF}"
info "Fetching official Supabase docker/ @ ${REF}"

mkdir -p "$CACHE_DIR"
WORKDIR="$(mktemp -d "${CACHE_DIR}/clone.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

git clone --filter=blob:none --no-checkout --depth=1 --branch "$REF" --quiet \
  "$UPSTREAM_REPO" "$WORKDIR/supabase"
(
  cd "$WORKDIR/supabase"
  git sparse-checkout init --cone
  git sparse-checkout set docker
  git checkout --quiet
)

mkdir -p "$PROJECT_DIR"
# Copy docker/* into project without clobbering local data/secrets/kit files
src="$WORKDIR/supabase/docker"
# Refresh tracked upstream files; keep local .env and data dirs
shopt -s dotglob nullglob
for item in "$src"/*; do
  base="$(basename "$item")"
  case "$base" in
    .env) continue ;;
  esac
  if [[ -d "$item" && "$base" == "volumes" ]]; then
    mkdir -p "$PROJECT_DIR/volumes"
    for v in "$item"/*; do
      vb="$(basename "$v")"
      case "$vb" in
        db)
          mkdir -p "$PROJECT_DIR/volumes/db"
          for dbi in "$v"/*; do
            dbn="$(basename "$dbi")"
            [[ "$dbn" == "data" ]] && continue
            rm -rf "${PROJECT_DIR:?}/volumes/db/${dbn:?}"
            cp -a "$dbi" "$PROJECT_DIR/volumes/db/$dbn"
          done
          ;;
        storage)
          mkdir -p "$PROJECT_DIR/volumes/storage"
          ;;
        kit) continue ;;
        *)
          rm -rf "${PROJECT_DIR:?}/volumes/${vb:?}"
          cp -a "$v" "$PROJECT_DIR/volumes/$vb"
          ;;
      esac
    done
  else
    case "$base" in
      kit|docker-compose.kit.yml|backups) continue ;;
      *)
        rm -rf "${PROJECT_DIR:?}/${base:?}"
        cp -a "$item" "$PROJECT_DIR/$base"
        ;;
    esac
  fi
done

printf 'ref=%s\nfetched_at=%s\nsource=%s\n' "$REF" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$UPSTREAM_REPO" \
  > "$PROJECT_DIR/.supabase-version"

# Keep upstream license notices visible
if [[ -f "$WORKDIR/supabase/LICENSE" ]]; then
  cp "$WORKDIR/supabase/LICENSE" "$PROJECT_DIR/UPSTREAM_LICENSE"
fi

ok "Official files in $PROJECT_DIR (ref $REF)"
