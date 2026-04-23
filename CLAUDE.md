# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

SIP Scout — basketball scouting and live stat tracking app. Full spec: [.work/project_spec.txt](.work/project_spec.txt). Implementation plan with 6 waves × 12 sprints: [.work/plan.txt](.work/plan.txt).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 6, Tailwind CSS v4, TanStack Query v5, React Router v7, Zustand v5 |
| Backend | Express 5, Node.js 22 LTS, TypeScript strict |
| ORM | Drizzle ORM + Drizzle Kit |
| Auth | JWT (jose) + bcrypt |
| Database | PostgreSQL 17 |
| Charts | Recharts (data charts), custom SVG (shot chart) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Containers | Docker Compose (dev), docker-compose.prod.yml (production/AWS) |
| Proxy | nginx (production container + nginx.conf.template) |
| Push notifications | Web Push (VAPID via `web-push`) |
| PWA | vite-plugin-pwa + Workbox service worker |
| E2E tests | Playwright (`frontend/e2e/`) |
| CI/CD | GitHub Actions (.github/workflows/ci.yml + deploy.yml) |

## Common Commands

```bash
# Full stack (Docker Desktop)
docker compose up

# Backend dev
cd backend && npm run dev         # http://localhost:3001
cd backend && npm run typecheck
cd backend && npm run test:unit
cd backend && npm run test:integration
cd backend && npm run db:migrate
cd backend && npm run db:generate  # after schema changes

# Frontend dev
cd frontend && npm run dev         # http://localhost:5173
cd frontend && npm run typecheck
cd frontend && npm test
cd frontend && npx playwright test  # E2E (requires running stack)

# nginx config
bash nginx/generate-nginx-conf.sh  # DOMAIN=example.com bash nginx/generate-nginx-conf.sh
```

## Architecture — Clean Architecture (Hexagonal)

```text
domain/ → application/ → infrastructure/ → presentation/
```

### backend/src/domain/ — zero external imports

- `entities/` — plain TypeScript interfaces (User, Player, Game, StatEvent…)
- `repositories/` — repository interfaces (ports)
- `stat-calculators.ts` — all derived stat logic (eFG%, TS%, +/-, shot zone, run detection)

### backend/src/application/ — imports domain only

- One file per use case: `registerUser.ts`, `loginUser.ts`, `recordStatEvent.ts`, `recordSubstitution.ts`…
- Each use case is a single exported async function; dependencies injected as parameters

### backend/src/infrastructure/ — implements domain interfaces

- `database/schema/` — Drizzle table definitions (one file per entity group)
- `database/repositories/` — Drizzle implementations of domain repository interfaces
- `database/connection.ts` — singleton pool + `getDb()`
- `auth/jwt.ts` — token generation + verification
- `auth/token-hash.ts` — SHA-256 hash for refresh tokens
- `push/webpush.service.ts` — Web Push sender; no-ops when VAPID keys are not configured

### backend/src/presentation/ — Express routes + middleware

- Routes instantiate repository classes and call use cases
- `middleware/auth.middleware.ts` — JWT authenticate + requireRole
- `middleware/error.middleware.ts` — maps error codes to HTTP status

### frontend/src/

- `features/` — page-level modules (auth, teams, players, games, live, analytics, scouting, tournaments, settings)
- `components/` — shared UI: AppShell, ShotChart (custom SVG), charts (Recharts), Toast, ConflictResolutionDialog
- `lib/api.ts` — the ONLY file that fetches from the backend; auto-refreshes token on 401
- `lib/offlineQueue.ts` — IndexedDB queue for stat events recorded offline; flushed on reconnect
- `store/auth.store.ts` — Zustand + persist; holds accessToken, refreshToken, user
- `store/theme.store.ts` — Zustand + persist; holds theme (system/light/dark); calls `initTheme()` on app boot
- `hooks/useSettings.ts` — TanStack Query wrapper for GET/PUT /settings
- `hooks/usePushNotifications.ts` — VAPID subscription lifecycle (request permission → subscribe → save to backend)
- `hooks/useGameAlerts.ts` — pure alert detection (foul bonus, foul trouble, scoring run) + polling hook

## Key Domain Rules

- `stat-calculators.ts` is the single source of truth for ALL derived stats (PTS, FGM, eFG%, TS%, +/-, shot zones, scoring runs). Never compute stats inline in routes or components.
- All DB migrations are Drizzle-managed (`npm run db:generate` → `npm run db:migrate`). Never write raw SQL migration files.
- Every entity has `id UUID PK`, `created_at`, `updated_at`, `deleted_at` (soft delete).
- Soft-delete everywhere — `deleted_at IS NULL` filter is implicit in repository queries.
- STAT_TYPE enum: `2PM | 2PA | 3PM | 3PA | FTM | FTA | OREB | DREB | AST | TO | STL | BLK | DFD | PF | TF | FF | SUB_IN | SUB_OUT | PERIOD_START | PERIOD_END | TIMEOUT`
- Shot zones are assigned by `classifyShotZone(x, y)` — x/y are normalized 0.0–1.0.

## RBAC

Roles per team: `OWNER > COACH > ASSISTANT > SCOUT > VIEWER`

- `requireRole('OWNER', 'COACH')` middleware guards destructive routes
- Players can only view their own data (not other players' scouting data)

## n8n Workflow Conventions

Any automation workflows follow the governance model in `.claude/agents/automation-governance-architect.md`:
- Naming: `[ENV]-[SYSTEM]-[PROCESS]-[ACTION]-v[MAJOR.MINOR]`
- All workflows must include error branches and fallback paths

## Testing Rules

- Unit tests: mock repository interfaces only; live in `tests/unit/`
- Integration tests: real PostgreSQL 17; live in `tests/integration/`
- Each test file mirrors its source: `src/application/auth/registerUser.ts` → `tests/unit/auth/registerUser.test.ts`
- Run unit tests without Docker; integration tests require the `postgres` service

## AWS Migration Path

Zero application code changes required:
1. Swap Docker Compose → ECS Task Definitions or EC2
2. Swap `STORAGE_PATH` local storage → `multer-s3` + S3 bucket
3. Swap `.env` → AWS Secrets Manager
4. Swap `postgres` container → RDS PostgreSQL 17
5. Add CloudFront CDN in front of frontend

## nginx Config Generation

`nginx/nginx.conf` is gitignored — generated from the template:

```bash
bash nginx/generate-nginx-conf.sh                        # localhost
DOMAIN=yourdomain.com bash nginx/generate-nginx-conf.sh # production
```

## Gitflow

```text
main ← release/* ← develop ← feature/*
```

Active branch: `feature/wave-6-notifications-pwa` (from `develop`).
Never commit directly to `main` or `develop`.
