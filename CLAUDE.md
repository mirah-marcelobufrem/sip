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
| Auth | JWT (jose) + bcrypt; access token 15 min, refresh token 7 days |
| Database | PostgreSQL 17 |
| Charts | Recharts (data charts), custom SVG (shot chart + radar chart) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| PDF export | Puppeteer (headless Chrome) |
| Push notifications | Web Push (VAPID via `web-push`) |
| PWA | vite-plugin-pwa + Workbox service worker |
| E2E tests | Playwright (`frontend/e2e/`) |
| Containers | Docker Compose (dev), docker-compose.prod.yml (production/AWS) |
| Proxy | nginx (production container + nginx.conf.template) |
| CI/CD | GitHub Actions (.github/workflows/ci.yml + deploy.yml) |

## Common Commands

```bash
# Full stack — recommended (Docker Desktop required)
bash start.sh             # health-check-aware startup script
bash start.sh --build     # force full image rebuild
bash stop.sh              # stop and remove containers (keeps DB volume)
bash stop.sh --clean      # also remove node_modules volumes
bash stop.sh --clean-all  # remove everything including database
# or manually:
docker compose up

# Backend dev
cd backend && npm run dev         # http://localhost:3001
cd backend && npm run typecheck
cd backend && npm run lint
cd backend && npm run test:unit
cd backend && npm run test:integration
cd backend && npm run db:migrate
cd backend && npm run db:generate  # after schema changes
cd backend && npm run db:studio    # Drizzle Studio GUI on http://localhost:4983

# Run a single backend test (Jest)
cd backend && npx jest tests/unit/auth/registerUser.test.ts
cd backend && npx jest tests/unit/games/  # all tests in a directory

# Frontend dev (test runner is Vitest, not Jest)
cd frontend && npm run dev         # http://localhost:5173
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test            # vitest run (all)
cd frontend && npx vitest run src/features/auth/LoginPage.test.tsx
cd frontend && npx playwright test  # E2E (requires running stack)

# nginx config
bash nginx/generate-nginx-conf.sh  # DOMAIN=example.com bash nginx/generate-nginx-conf.sh
```

## Architecture — Clean Architecture (Hexagonal)

```text
domain/ → application/ → infrastructure/ → presentation/
```

### Path Aliases

| Alias | Resolves to | Where |
| --- | --- | --- |
| `@domain/*` | `backend/src/domain/*` | backend tsconfig + jest |
| `@application/*` | `backend/src/application/*` | backend tsconfig + jest |
| `@infrastructure/*` | `backend/src/infrastructure/*` | backend tsconfig + jest |
| `@presentation/*` | `backend/src/presentation/*` | backend tsconfig + jest |
| `@/*` | `frontend/src/*` | frontend vite + vitest |

### Required Environment Variables

The root `.env` (gitignored, copy from `.env.example`) must include:

```env
DATABASE_URL=postgresql://sip:sip@localhost:5432/sip  # used by backend connection.ts
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ANTHROPIC_API_KEY=sk-ant-...  # AI routes no-op without it

# Optional — push notifications disabled if absent
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com

# Optional — frontend uses /api/v1 by default (nginx proxy in prod)
VITE_API_URL=http://localhost:3001/api/v1
```

### Backend ESM Convention

All backend TypeScript files use **`.js` extensions in import paths**, not `.ts`. This is required because the backend compiles to native ESM (`"module": "ESNext"`). Always write:

```ts
import { foo } from './bar.js';          // correct
import type { Baz } from '@domain/entities/game.entity.js';  // correct
```

### backend/src/domain/ — zero external imports

- `entities/` — plain TypeScript interfaces (User, Player, Game, StatEvent…)
- `repositories/` — repository interfaces (ports); `value-objects/` exists but is currently empty
- `stat-calculators.ts` — all derived stat logic (eFG%, TS%, +/-, shot zone, run detection)
- `tournament-bracket.ts` — bracket seeding and advancement logic

### backend/src/application/ — imports domain only

- Only `auth/` and `games/` have dedicated use-case files: `registerUser.ts`, `loginUser.ts`, `refreshTokens.ts`, `recordStatEvent.ts`, `recordSubstitution.ts`. All other business logic (analytics, AI, export, scouting, tournaments, etc.) is implemented inline inside route files.
- Each use case is a single exported async function; dependencies injected as parameters
- **Zod parse pattern:** every use case calls `Schema.parse(rawInput)` internally — never rely on route-level validation alone
- **Input type pattern:** use `z.input<typeof Schema>` for function parameters when the schema has `.default()` fields, so callers don't need to supply defaulted values (e.g. `RecordStatEventRawInput`)

### backend/src/infrastructure/ — implements domain interfaces

- `database/schema/` — Drizzle table definitions (one file per entity group)
- `database/repositories/` — Drizzle implementations of domain repository interfaces
- `database/connection.ts` — singleton pool + `getDb()`
- `auth/jwt.ts` — token generation + verification
- `auth/token-hash.ts` — SHA-256 hash for refresh tokens
- `push/webpush.service.ts` — Web Push sender; no-ops when VAPID keys are not configured

### backend/src/presentation/ — Express routes + middleware

- Routes instantiate repository classes and call use cases
- `middleware/auth.middleware.ts` — JWT authenticate + requireRole; augments `Express.Request` with `req.userId: string` and `req.userRole?: TeamRole` (NOT `req.user`)
- `middleware/error.middleware.ts` — maps error codes to HTTP status
- **Error throwing convention:** `throw Object.assign(new Error('message'), { code: 'CODE' })`. The `code` is matched against `statusMap` in `errorMiddleware`. Known codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`, `USER_NOT_FOUND`.

### frontend/src/

- `features/` — page-level modules: auth, teams, players, games, live, analytics, scouting, tournaments, settings
- `components/` — shared UI: AppShell, Toast, ConflictResolutionDialog
  - `layout/AppShell.tsx` — top header bar + slide-in sidebar overlay. Layout is `flex-col h-screen` (header + main). Sidebar is `position: fixed`, slides in from the left with CSS `translate-x`. Toggle state is local `useState`; sidebar auto-closes on route change via `useEffect` watching `location.pathname`. Backdrop (`data-testid="nav-backdrop"`) closes the menu on click.
  - `ui/ConflictResolutionDialog.tsx` — field-level conflict UI shown when the same entity was edited on two devices offline; props: `entityName`, `conflicts: { field, localValue, remoteValue, localUpdatedAt, remoteUpdatedAt }[]`, `onResolve`, `onDismiss`
  - `charts/courtLines.tsx` — `<CourtLines W H />` shared SVG court geometry; imported by both `ShotChart` and `CourtLocationPicker` — edit court geometry here only
  - `charts/ShotChart.tsx` — renders shot dots/heat on the half-court SVG; props: `shots[]`, `width?`, `height?`, `mode?: 'dots' | 'heat'`
  - `charts/CourtLocationPicker.tsx` — full-screen modal SVG for tapping a shot location during live recording; shown for shot stat types (`2PM/2PA/3PM/3PA`); exports `ShotStatType`
  - `charts/RadarChart.tsx` — pure SVG polygon radar; props: `axes: { label, value }[]`, `size?`, `color?`; values on 0–10 scale
  - `charts/GameFlowChart.tsx` — Recharts `LineChart` wrapping score differential; props: `flowPoints[]`, `scoringRuns[]`, `homeLabel?`, `awayLabel?`
- `lib/api.ts` — the ONLY file that fetches from the backend; auto-refreshes token on 401
- `lib/offlineQueue.ts` — IndexedDB queue for stat events recorded offline; flushed on `window.online`
- `store/auth.store.ts` — Zustand + persist; `accessToken` is in-memory only (not persisted); only `refreshToken` + `user` survive a page reload — `refresh()` is called on 401 to silently get a new access token
- `store/theme.store.ts` — Zustand + persist; holds theme (system/light/dark); call `initTheme()` on app boot
- `hooks/useSettings.ts` — TanStack Query wrapper for GET/PUT /settings; `UserPreferences` type (language, units, theme, game format, foul limits, shot chart, opponent tracking, notification toggles, colors)
- `hooks/usePushNotifications.ts` — VAPID subscription lifecycle (request permission → subscribe → save to backend); `PushStatus: 'unsupported' | 'denied' | 'granted' | 'prompt' | 'subscribing'`
- `hooks/useGameAlerts.ts` — pure alert detection (foul bonus, foul trouble, scoring run) + interval polling hook with `seenIds` dedup

## Frontend Routes

| Path | Component |
| --- | --- |
| `/login` | LoginPage |
| `/register` | RegisterPage |
| `/bracket/:token` | PublicBracketPage (no auth) |
| `/teams` | TeamsPage |
| `/teams/:teamId/players` | PlayersPage |
| `/teams/:teamId/players/:playerId` | PlayerCardPage |
| `/teams/:teamId/games` | GamesPage |
| `/games/:gameId/live` | LiveRecordingPage |
| `/games/:gameId/box-score` | BoxScorePage |
| `/games/:gameId/shots` | GameShotMapPage |
| `/teams/:teamId/analytics` | AnalyticsDashboard |
| `/scouting` | ScoutingPage |
| `/tournaments` | TournamentsPage |
| `/tournaments/:id` | TournamentDetailPage |
| `/settings` | SettingsPage |
| `/account` | AccountPage |

## API Surface (all under `/api/v1`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Register (rate-limited) |
| POST | `/auth/login` | — | Login (rate-limited) |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/logout` | ✓ | Revoke refresh token |
| GET | `/auth/me` | ✓ | Current user profile |
| GET | `/teams` | ✓ | List teams for user |
| POST | `/teams` | ✓ | Create team |
| GET | `/teams/:id` | ✓ | Get team |
| PUT | `/teams/:id` | ✓ | Update team |
| DELETE | `/teams/:id` | ✓ | Delete team |
| GET | `/teams/:id/members` | ✓ | List team members |
| GET | `/teams/:teamId/players` | ✓ | List players |
| POST | `/teams/:teamId/players` | ✓ | Create player |
| GET | `/teams/:teamId/players/:id` | ✓ | Get player |
| PUT | `/teams/:teamId/players/:id` | ✓ | Update player |
| DELETE | `/teams/:teamId/players/:id` | ✓ | Delete player |
| GET | `/teams/:teamId/games` | ✓ | List games |
| POST | `/teams/:teamId/games` | ✓ | Create game |
| GET | `/teams/:teamId/games/season-stats` | ✓ | Season aggregate stats |
| GET | `/games/:gameId` | ✓ | Get game |
| PATCH | `/games/:gameId` | ✓ | Update game |
| POST | `/games/:gameId/start` | ✓ | Start game |
| POST | `/games/:gameId/complete` | ✓ | Complete game |
| POST | `/games/:gameId/events` | ✓ | Record stat event |
| DELETE | `/games/:gameId/events/:eventId` | ✓ | Delete stat event |
| POST | `/games/:gameId/lineups` | ✓ | Record lineup snapshot |
| GET | `/games/:gameId/log` | ✓ | Event log |
| GET | `/games/:gameId/box-score` | ✓ | Box score |
| GET | `/games/:gameId/flow` | ✓ | Score flow |
| GET | `/games/:gameId/lineups` | ✓ | Lineup snapshots |
| GET | `/players/:playerId/shot-chart` | ✓ | Player shot chart |
| GET | `/teams/:teamId/players/season-stats` | ✓ | Team season stats |
| GET | `/teams/:teamId/lineup-stats` | ✓ | Lineup analytics |
| GET | `/teams/:teamId/on-off/:playerId` | ✓ | On/off analysis |
| GET | `/teams/:teamId/efficiency` | ✓ | Efficiency metrics |
| GET | `/teams/:teamId/players/:playerId/shot-chart` | ✓ | Player+team shot chart |
| GET | `/games/:gameId/player-stats` | ✓ | Game player stats |
| GET | `/scouting-reports` | ✓ | List reports |
| POST | `/scouting-reports` | ✓ | Create report |
| GET | `/scouting-reports/:id` | ✓ | Get report |
| PUT | `/scouting-reports/:id` | ✓ | Update report |
| DELETE | `/scouting-reports/:id` | ✓ | Delete report |
| POST | `/scouting-reports/:id/share` | ✓ | Share report |
| GET | `/tournaments` | ✓ | List tournaments |
| POST | `/tournaments` | ✓ | Create tournament |
| GET | `/tournaments/:id` | ✓ | Get tournament |
| PUT | `/tournaments/:id` | ✓ | Update tournament |
| DELETE | `/tournaments/:id` | ✓ | Delete tournament |
| GET | `/tournaments/:id/bracket` | ✓ | Bracket |
| PATCH | `/tournaments/:id/slots/:slotId` | ✓ | Update bracket slot |
| GET | `/tournaments/:id/standings` | ✓ | Standings |
| POST | `/tournaments/:id/share` | ✓ | Share tournament |
| POST | `/ai/game-recap/:gameId` | ✓ | AI game recap |
| POST | `/ai/scouting-assist` | ✓ | AI scouting assistant |
| POST | `/ai/lineup-recommendation/:teamId` | ✓ | AI lineup recommendation |
| POST | `/ai/development-insights/:playerId` | ✓ | AI development insights |
| GET | `/export/game/:gameId/csv` | ✓ | Export game CSV |
| GET | `/export/game/:gameId/json` | ✓ | Export game JSON |
| GET | `/export/player/:id/card/pdf` | ✓ | Export player card PDF |
| GET | `/export/scouting/:id/pdf` | ✓ | Export scouting report PDF |
| GET | `/settings` | ✓ | Get preferences |
| PUT | `/settings` | ✓ | Update preferences |
| GET | `/notifications/vapid-public-key` | — | VAPID public key |
| POST | `/notifications/subscribe` | ✓ | Save push subscription |
| DELETE | `/notifications/subscribe` | ✓ | Remove push subscription |
| GET | `/account/export` | ✓ | LGPD/GDPR data export (JSON download) |
| DELETE | `/account` | ✓ | Delete account (soft-delete + anonymize) |

## Database Schema (22 tables)

| Table | Schema file |
| --- | --- |
| `users` | users.schema.ts |
| `user_team_roles` | users.schema.ts |
| `invitations` | users.schema.ts |
| `refresh_tokens` | users.schema.ts |
| `organizations` | organizations.schema.ts |
| `teams` | teams.schema.ts |
| `players` | players.schema.ts |
| `games` | games.schema.ts |
| `game_templates` | games.schema.ts |
| `stat_events` | stat-events.schema.ts |
| `stat_event_audits` | stat-events.schema.ts |
| `lineup_snapshots` | lineup-snapshots.schema.ts |
| `opponent_teams` | opponents.schema.ts |
| `opponent_players` | opponents.schema.ts |
| `scouting_reports` | scouting.schema.ts |
| `development_entries` | development.schema.ts |
| `development_goals` | development.schema.ts |
| `tournaments` | tournaments.schema.ts |
| `tournament_games` | tournaments.schema.ts |
| `settings` | settings.schema.ts |
| `push_subscriptions` | push-subscriptions.schema.ts |
| `notification_logs` | push-subscriptions.schema.ts |

## Key Domain Rules

- `stat-calculators.ts` is the single source of truth for ALL derived stats. Never compute stats inline in routes or components.
- **`fga` formula:** `fga = twopm + twopa + threepm + threepa` — made shots count as attempts. Do NOT use `twopa + threepa` (miss-only) which was a historic bug.
- All DB migrations are Drizzle-managed (`npm run db:generate` → `npm run db:migrate`). Never write raw SQL migration files.
- Every entity has `id UUID PK`, `created_at`, `updated_at`, `deleted_at` (soft delete).
- Soft-delete everywhere — `deleted_at IS NULL` filter is implicit in repository queries.
- Account deletion: revokes all tokens, soft-deletes the user row, and anonymizes email to `deleted-{id}@deleted.invalid`.
- STAT_TYPE enum: `2PM | 2PA | 3PM | 3PA | FTM | FTA | OREB | DREB | AST | TO | STL | BLK | DFD | PF | TF | FF | SUB_IN | SUB_OUT | PERIOD_START | PERIOD_END | TIMEOUT`
- Shot zones are assigned by `classifyShotZone(x, y)` — x/y are normalized 0.0–1.0.
- **Skill ratings** in scouting reports are stored as JSON under the key `skillRatings`. The 10 canonical keys are: `scoring`, `ballHandling`, `passing`, `offBallMovement`, `defenseOnBall`, `defenseHelp`, `rebounding`, `athleticism`, `basketballIq`, `clutch` (all 0–10). Never add new keys without updating `SKILL_LABELS` in both `ScoutingPage.tsx` and `PlayerCardPage.tsx`.
- **Box-score endpoint** (`GET /games/:gameId/box-score`) returns per-player rows that include `playerName`, `jerseyNumber`, `teamId`, and `isHomeTeam`. Names are resolved by joining both `players` (own roster) and `opponent_players` tables. Always use these fields — never display raw `playerId` UUIDs.
- **LiveRecordingPage** tracks both teams' lineups independently. The foul BONUS threshold is 5 fouls per quarter (`FOUL_BONUS_THRESHOLD = 5`). Substitutions go through `POST /games/:gameId/lineups`; period advance through `PATCH /games/:gameId`.
- **AnalyticsDashboard** has three tabs: Season (leaders table + trend chart + efficiency metrics), Lineups (top 5-man combos from `/teams/:teamId/lineup-stats`), and Game Flow (game selector + `GameFlowChart` from `/games/:gameId/flow`). Lineup data only loads when the Lineups tab is active (`enabled: activeTab === 'lineup'`).
- **PlayersPage** edit modal calls `PUT /teams/:teamId/players/:id` with full player fields including `status`. Valid status values: `active`, `injured`, `hidden`, `transferred`.

## RBAC

Roles per team: `OWNER > COACH > ASSISTANT > SCOUT > VIEWER`

- `requireRole('OWNER', 'COACH')` middleware guards destructive routes
- Players can only view their own data (not other players' scouting data)

## Testing Rules

- Unit tests: mock repository interfaces only; live in `tests/unit/`
- Integration tests: real PostgreSQL 17; live in `tests/integration/`
- Each test file mirrors its source: `src/application/auth/registerUser.ts` → `tests/unit/auth/registerUser.test.ts`
- Run unit tests without Docker; integration tests require the `postgres` service
- E2E tests live in `frontend/e2e/` and run via Playwright — excluded from Vitest via `vitest.config.ts`
- All mock IDs in tests must be valid UUIDs (e.g. `'00000000-0000-0000-0000-000000000001'`) — Zod uuid() validation runs inside use cases
- Use factory functions (`makeUserRepo()`, `makeSettingsRepo()`) that return complete mock objects with `jest.fn()` stubs; pass `overrides` to customize per-test

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

## Subagents

This project uses the **global** Claude Code subagents located at `/Users/marcelobufrem/.claude/agents/`. There are no project-level agents — do not create a `.claude/agents/` directory here.

Relevant agents for this project and their typical use:

| Category | Folder | Use for |
| --- | --- | --- |
| `engineering/` | `engineering-frontend-developer`, `engineering-backend-architect`, `engineering-senior-developer`, `engineering-software-architect`, `engineering-devops-automator` | Feature implementation, architecture decisions, infra changes |
| `testing/` | `testing-api-tester`, `testing-reality-checker` | API validation, production-readiness checks |
| `design/` | `design-ui-designer` | UI/UX improvements |

When orchestrating complex tasks, follow the standard chains from the global CLAUDE.md (PM → Backend → Frontend → QA → DevOps, etc.) using these global agents.

## GitFlow

```text
main ← release/* ← develop ← feature/*
```

Current state: all 6 waves shipped. `release/1.0.0` was merged to `main` (tagged `v1.0.0`) and back-merged to `develop`. Active work happens on `develop` or a new `feature/*` branch.

Never commit directly to `main` or `develop`.
