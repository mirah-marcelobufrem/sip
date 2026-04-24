#!/usr/bin/env bash
# start.sh — Start the SIP Scout development stack
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

# ── preflight ───────────────────────────────────────────────────────────────
step "Preflight checks"

command -v docker >/dev/null 2>&1 || fail "Docker is not installed or not in PATH"
docker info >/dev/null 2>&1       || fail "Docker daemon is not running — open Docker Desktop first"
ok "Docker daemon is running"

[[ -d "$PROJECT_DIR" ]] || fail "Project directory not found: $PROJECT_DIR"
cd "$PROJECT_DIR"
ok "Working directory: $PROJECT_DIR"

# ── optional rebuild flag ────────────────────────────────────────────────────
BUILD_FLAG=""
if [[ "${1:-}" == "--build" ]]; then
  BUILD_FLAG="--build --no-cache"
  warn "Full rebuild requested (--build --no-cache)"
fi

# ── start postgres ───────────────────────────────────────────────────────────
step "Starting PostgreSQL"
docker compose up -d postgres $BUILD_FLAG
info "Waiting for postgres health check…"
for i in $(seq 1 70); do
  CID=$(docker compose ps -q postgres 2>/dev/null || true)
  STATUS=$([ -n "$CID" ] && docker inspect --format='{{.State.Health.Status}}' "$CID" 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    ok "PostgreSQL is healthy"
    break
  fi
  if [[ $i -eq 70 ]]; then
    docker compose logs postgres --tail 20
    fail "PostgreSQL did not become healthy after 70 seconds"
  fi
  sleep 1
done

# ── start backend ─────────────────────────────────────────────────────────────
step "Starting backend"
# Step 1: create the container (volumes initialized from image on first run)
docker compose up -d --no-deps backend $BUILD_FLAG
info "Waiting 6 s for volume initialisation…"
sleep 6

# Step 2: stop the container (avoids the Apple-Silicon Docker volume init restart loop)
docker compose stop backend >/dev/null 2>&1 || true

# Step 3: start it cleanly — picks up the correct Linux node_modules volume
docker compose start backend
info "Waiting for backend API to respond…"
for i in $(seq 1 60); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/auth/login \
         -X POST -H 'Content-Type: application/json' \
         -d '{"email":"x","password":"x"}' 2>/dev/null || echo "000")
  if [[ "$HTTP" =~ ^[24] ]]; then
    ok "Backend is responding (HTTP $HTTP)"
    break
  fi
  if [[ $i -eq 60 ]]; then
    docker compose logs backend --tail 30
    fail "Backend did not respond after 60 seconds"
  fi
  sleep 1
done

# ── start frontend ────────────────────────────────────────────────────────────
step "Starting frontend"
# Same two-step trick for the frontend
docker compose up -d --no-deps --force-recreate frontend $BUILD_FLAG
info "Waiting 6 s for volume initialisation…"
sleep 6
docker compose stop frontend >/dev/null 2>&1 || true
docker compose start frontend
info "Waiting for Vite dev server to respond…"
for i in $(seq 1 60); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    ok "Frontend is responding (HTTP $HTTP)"
    break
  fi
  if [[ $i -eq 60 ]]; then
    docker compose logs frontend --tail 30
    fail "Frontend did not respond after 60 seconds"
  fi
  sleep 1
done

# ── final status ──────────────────────────────────────────────────────────────
step "Stack status"
docker compose ps

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  SIP Scout is ready${RESET}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}Frontend${RESET}   http://localhost:5173"
echo -e "  ${BOLD}Backend${RESET}    http://localhost:3001/api/v1"
echo -e "  ${BOLD}Postgres${RESET}   localhost:5432  (sip / sip)"
echo ""
