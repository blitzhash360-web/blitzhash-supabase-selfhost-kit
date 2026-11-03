#!/usr/bin/env bash
# Shared helpers for BlitzHash Self-Host Supabase Kit.
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="${BLITZHASH_SUPABASE_DIR:-${KIT_ROOT}/supabase-project}"
UPSTREAM_REF="${BLITZHASH_UPSTREAM_REF:-self-hosted/v0.8.3}"
UPSTREAM_REPO="${BLITZHASH_UPSTREAM_REPO:-https://github.com/supabase/supabase}"
CACHE_DIR="${KIT_ROOT}/.upstream-cache"
export KIT_ROOT PROJECT_DIR UPSTREAM_REF UPSTREAM_REPO CACHE_DIR

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
ok() { echo "ok: $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

check_docker() {
  require_cmd docker
  if ! docker info >/dev/null 2>&1; then
    die "Docker daemon is not reachable. Start Docker Desktop / Docker Engine and retry."
  fi
  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose plugin missing. Install Docker Compose v2 (docker compose)."
  fi
  ok "Docker $(docker --version | head -1)"
  ok "Compose $(docker compose version | head -1)"
}

ensure_project() {
  [[ -d "$PROJECT_DIR" ]] || die "project directory missing: $PROJECT_DIR (run ./setup.sh first)"
  [[ -f "$PROJECT_DIR/docker-compose.yml" ]] || die "docker-compose.yml missing in $PROJECT_DIR"
}

load_env() {
  ensure_project
  [[ -f "$PROJECT_DIR/.env" ]] || die ".env missing in $PROJECT_DIR"
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
}

in_project() {
  (cd "$PROJECT_DIR" && "$@")
}
