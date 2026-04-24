#!/usr/bin/env bash
# stop.sh — Stop the SIP Scout development stack
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── colours ────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}✔  $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠  $*${RESET}"; }
fail()  { echo -e "${RED}✖  $*${RESET}"; exit 1; }
info()  { echo -e "   $*"; }

# ── preflight ────────────────────────────────────────────────────────────────
step "Preflight checks"

command -v docker >/dev/null 2>&1 || fail "Docker is not installed or not in PATH"
docker info >/dev/null 2>&1       || fail "Docker daemon is not running"
ok "Docker daemon is running"

[[ -d "$PROJECT_DIR" ]] || fail "Project directory not found: $PROJECT_DIR"
cd "$PROJECT_DIR"
ok "Working directory: $PROJECT_DIR"

# ── parse flags ───────────────────────────────────────────────────────────────
REMOVE_MODULES=false
REMOVE_ALL=false

for arg in "$@"; do
  case "$arg" in
    --clean)        REMOVE_MODULES=true ;;
    --clean-all)    REMOVE_ALL=true ;;
  esac
done

# ── stop and remove containers ────────────────────────────────────────────────
step "Stopping containers"
docker compose down
ok "All containers stopped and removed"

# ── volume management ─────────────────────────────────────────────────────────
if $REMOVE_ALL; then
  step "Removing ALL volumes (including database data)"
  warn "This will permanently delete the PostgreSQL database!"
  read -r -p "   Are you sure? [y/N] " confirm
  if [[ "${confirm,,}" == "y" ]]; then
    docker volume rm sip_postgres_data sip_uploads sip_backend_modules sip_frontend_modules 2>/dev/null || true
    ok "All volumes removed"
  else
    info "Skipped — volumes untouched"
  fi
elif $REMOVE_MODULES; then
  step "Removing node_modules volumes (preserving database)"
  info "This forces a clean npm ci on next start"
  docker volume rm sip_backend_modules sip_frontend_modules 2>/dev/null || true
  ok "node_modules volumes removed"
else
  step "Persistent volumes (retained)"
  info "Database and uploads are preserved across restarts."
  info "To also clear node_modules: $0 --clean"
  info "To clear everything incl. database: $0 --clean-all"
fi

# ── final status ──────────────────────────────────────────────────────────────
step "Remaining volumes"
docker volume ls --filter "name=sip_" 2>/dev/null || true

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  SIP Scout stopped${RESET}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
