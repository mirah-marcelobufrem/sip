# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

SIP Scout — basketball scouting and live stat tracking app. Original spec: [.work/project_spec.txt](.work/project_spec.txt). Active plan: [.work/roadmap.txt](.work/roadmap.txt) (v3.0, 18 sprints — supersedes the original `plan.txt` and the standalone FIBA implementation plan). For FIBA stat-correctness work (S07+), the reverse-engineered FIBA LiveStats reference spec lives at [.work/specs/](.work/specs/) and has its own routing `CLAUDE.md`.

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

- `entities/` — plain TypeScript interfaces (User, Player, Game, StatEvent, PossessionState…)
- `repositories/` — repository interfaces (ports); `value-objects/` exists but is currently empty
- `stat-calculators.ts` — all derived stat logic (eFG%, TS%, +/-, shot zone, run detection, possession resolution, 3pt geometry, FIBA MET-1 minutes, foul bonus)
- `action-flag-validator.ts` — FIBA BR-STAT rule validators: 14 pure named rules (`ruleBRSTAT_2_2` … `ruleBRSTAT_9_2`) + `validateAction(event, ctx): ValidationResult[]` pipeline. Rules detect and describe violations (`FlagKind: 'MissingFGA' | 'User' | 'AutoCorrect'`) — they never mutate or insert events; the S08 capture engine consumes the results. Rules whose FIBA triggers need S07 event subtypes are approximated against today's model (documented in each rule's JSDoc).
- `tournament-bracket.ts` — bracket seeding and advancement logic

### backend/src/application/ — imports domain only

- Only `auth/` and `games/` have dedicated use-case files: `registerUser.ts`, `loginUser.ts`, `refreshTokens.ts`, `recordStatEvent.ts`, `recordSubstitution.ts`, `createGame.ts`. All other business logic (analytics, AI, export, scouting, tournaments, etc.) is implemented inline inside route files.
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

- `features/` — page-level modules: auth, teams, players, games, live, analytics, scouting, tournaments, settings. There is no `opponents/` module — `OpponentTeamsPage.tsx` and `OpponentProfilePage.tsx` live in `features/teams/`.
- `components/` — shared UI: AppShell, Toast, ConflictResolutionDialog, ShareSheet
  - `layout/AppShell.tsx` — top header bar + slide-in sidebar overlay. Layout is `flex-col h-screen` (header + main). Sidebar is `position: fixed`, slides in from the left with CSS `translate-x`. Toggle state is local `useState`; sidebar auto-closes on route change via `useEffect` watching `location.pathname`. Backdrop (`data-testid="nav-backdrop"`) closes the menu on click. Sidebar includes "Opponents" nav item between Teams and Scouting.
  - `ui/ConflictResolutionDialog.tsx` — field-level conflict UI shown when the same entity was edited on two devices offline; props: `entityName`, `conflicts: { field, localValue, remoteValue, localUpdatedAt, remoteUpdatedAt }[]`, `onResolve`, `onDismiss`
  - `ui/ShareSheet.tsx` — bottom-drawer (mobile) / popover (desktop) share component; props: `url`, `pdfUrl?`, `csvUrl?`; actions: Copy Link (2s "Copied!" feedback), WhatsApp, Email, Download PDF, Download CSV. Wired into ScoutingPage, PlayerCardPage, TournamentDetailPage.
  - `charts/courtLines.tsx` — `<CourtLines W H />` shared SVG court geometry; imported by both `ShotChart` and `CourtLocationPicker` — edit court geometry here only
  - `charts/ShotChart.tsx` — renders shot dots/heat on the half-court SVG; props: `shots[]`, `width?`, `height?`, `mode?: 'dots' | 'heat'`
  - `charts/CourtLocationPicker.tsx` — full-screen modal SVG for tapping a shot location during live recording; shown for shot stat types (`2PM/2PA/3PM/3PA`); exports `ShotStatType`
  - `charts/RadarChart.tsx` — pure SVG polygon radar; props: `axes: { label, value }[]`, `size?`, `color?`; values on 0–10 scale
  - `charts/GameFlowChart.tsx` — Recharts `LineChart` wrapping score differential; props: `flowPoints[]`, `scoringRuns[]`, `homeLabel?`, `awayLabel?`; scoring run bands rendered as amber `ReferenceArea`
- `lib/api.ts` — the ONLY file that fetches from the backend; auto-refreshes token on 401
- `lib/offlineQueue.ts` — IndexedDB queue for stat events recorded offline; flushed on `window.online`
- `store/auth.store.ts` — Zustand + persist; `accessToken` is in-memory only (not persisted); only `refreshToken` + `user` survive a page reload — `refresh()` is called on 401 to silently get a new access token. Concurrent `refresh()` calls are deduped via a module-level shared promise. `_hasHydrated` is set by `onRehydrateStorage`; the `RequireAuth` guard in `App.tsx` renders nothing until hydration completes and treats `user || refreshToken` (not `accessToken`) as authenticated.
- `store/theme.store.ts` — Zustand + persist; holds theme (system/light/dark); call `initTheme()` on app boot
- `hooks/useSettings.ts` — TanStack Query wrapper for GET/PUT /settings; `UserPreferences` type (language, units, theme, game format, foul limits, shot chart, opponent tracking, notification toggles, colors)
- `hooks/usePushNotifications.ts` — VAPID subscription lifecycle (request permission → subscribe → save to backend); `PushStatus: 'unsupported' | 'denied' | 'granted' | 'prompt' | 'subscribing'`
- `hooks/useGameAlerts.ts` — pure alert detection (foul bonus, foul trouble, scoring run) + interval polling hook with `seenIds` dedup

## Frontend Routes

| Path | Component |
| --- | --- |
| `/login` | LoginPage |
| `/register` | RegisterPage |
| `/forgot-password` | ForgotPasswordPage (no auth) |
| `/reset-password` | ResetPasswordPage (no auth, reads `?token=`) |
| `/bracket/:token` | PublicBracketPage (no auth) |
| `/scouting/share/:token` | PublicScoutingReportPage (no auth) |
| `/teams` | TeamsPage |
| `/teams/:teamId/players` | PlayersPage |
| `/teams/:teamId/players/:playerId` | PlayerCardPage |
| `/teams/:teamId/players/compare` | PlayerComparisonPage (up to 4 players) |
| `/teams/:teamId/games` | GamesPage |
| `/teams/:teamId/season-box-score` | SeasonBoxScorePage |
| `/teams/:teamId/analytics` | AnalyticsDashboard |
| `/teams/:teamId/analytics/on-off` | OnOffPage |
| `/games/:gameId/live` | LiveRecordingPage |
| `/games/:gameId/box-score` | BoxScorePage |
| `/games/:gameId/log` | GameLogPage |
| `/games/:gameId/shots` | GameShotMapPage |
| `/opponent-teams` | OpponentTeamsPage |
| `/opponent-teams/:id` | OpponentProfilePage |
| `/scouting` | ScoutingPage |
| `/tournaments` | TournamentsPage |
| `/tournaments/:id` | TournamentDetailPage |
| `/settings` | SettingsPage |
| `/account` | AccountPage |

## API Surface (all under `/api/v1`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Register (rate-limited in production only) |
| POST | `/auth/login` | — | Login (rate-limited in production only) |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/logout` | ✓ | Revoke refresh token |
| GET | `/auth/me` | ✓ | Current user profile |
| POST | `/auth/forgot-password` | — | Request password reset (always 200) |
| POST | `/auth/reset-password` | — | Consume reset token + set new password |
| GET | `/game-templates` | ✓ | List game templates for user |
| POST | `/game-templates` | ✓ | Create game template |
| DELETE | `/game-templates/:id` | ✓ | Delete game template |
| GET | `/teams` | ✓ | List teams for user |
| POST | `/teams` | ✓ | Create team |
| GET | `/teams/:id` | ✓ | Get team |
| PUT | `/teams/:id` | ✓ | Update team |
| DELETE | `/teams/:id` | ✓ | Delete team |
| GET | `/teams/:id/members` | ✓ | List team members |
| PUT | `/teams/:id/members/:userId` | ✓ OWNER | Change member role |
| DELETE | `/teams/:id/members/:userId` | ✓ | Remove member (or self-leave) |
| POST | `/teams/:id/invitations` | ✓ OWNER/COACH | Create invite token (logged to console) |
| POST | `/invitations/accept` | — | Accept invite (joins team; returns `requiresAuth:true` if no session) |
| GET | `/teams/:teamId/players` | ✓ | List players |
| POST | `/teams/:teamId/players` | ✓ | Create player |
| POST | `/teams/:teamId/players/import` | ✓ | CSV bulk import (`text/csv` body) |
| GET | `/teams/:teamId/players/:id` | ✓ | Get player |
| PUT | `/teams/:teamId/players/:id` | ✓ | Update player |
| DELETE | `/teams/:teamId/players/:id` | ✓ | Delete player |
| GET | `/teams/:teamId/games` | ✓ | List games (optional `?tournamentId=`) |
| POST | `/teams/:teamId/games` | ✓ | Create game (optional `tournamentId`; defaults to the team's "Friendly" tournament) |
| GET | `/teams/:teamId/games/season-stats` | ✓ | Season aggregate stats |
| GET | `/teams/:teamId/players/season-stats` | ✓ | Team season stats (`?dateFrom`, `?dateTo`, `?per36=true`) |
| GET | `/teams/:teamId/trend-stats` | ✓ | Per-game trend by stat (`?stat=pts&playerId=uuid`) |
| GET | `/teams/:teamId/matchups` | ✓ | Matchup history vs opponent name (`?opponentName=`) |
| GET | `/teams/:teamId/combo-stats` | ✓ | 2-man / 3-man combo +/- (`?size=2or3&minEvents=5`) |
| GET | `/teams/:teamId/lineup-stats` | ✓ | Lineup analytics |
| GET | `/teams/:teamId/on-off/:playerId` | ✓ | On/off analysis |
| GET | `/teams/:teamId/efficiency` | ✓ | Efficiency metrics |
| GET | `/teams/:teamId/players/:playerId/shot-chart` | ✓ | Player+team shot chart |
| GET | `/teams/:teamId/tournaments` | ✓ | List team's tournaments (always includes auto-created "Friendly") |
| GET | `/games/:gameId` | ✓ | Get game |
| PATCH | `/games/:gameId` | ✓ | Update game |
| POST | `/games/:gameId/start` | ✓ | Start game |
| POST | `/games/:gameId/complete` | ✓ | Complete game |
| POST | `/games/:gameId/events` | ✓ | Record stat event (optional `insertAfterId`) |
| PATCH | `/games/:gameId/events/:eventId` | ✓ OWNER/COACH | Update event (audit-logged to `stat_event_audits`) |
| DELETE | `/games/:gameId/events/:eventId` | ✓ | Delete stat event |
| POST | `/games/:gameId/lineups/initial` | ✓ | Record initial lineup (`{ teamId, playerIds[] }`) |
| POST | `/games/:gameId/lineups` | ✓ | Record substitution lineup snapshot |
| GET | `/games/:gameId/log` | ✓ | Event log (grouped by period) |
| GET | `/games/:gameId/box-score` | ✓ | Box score |
| GET | `/games/:gameId/flow` | ✓ | Score flow |
| GET | `/games/:gameId/lineups` | ✓ | Lineup snapshots |
| GET | `/games/:gameId/player-stats` | ✓ | Game player stats |
| GET | `/players/:playerId/shot-chart` | ✓ | Player shot chart |
| GET | `/players/:playerId/development` | ✓ | List development entries |
| POST | `/players/:playerId/development` | ✓ | Create development entry |
| PUT | `/players/:playerId/development/:entryId` | ✓ | Update development entry |
| DELETE | `/players/:playerId/development/:entryId` | ✓ | Delete development entry |
| GET | `/players/:playerId/development/chart` | ✓ | Entries grouped by metric (for charts) |
| GET | `/players/:playerId/development/goals` | ✓ | List development goals |
| POST | `/players/:playerId/development/goals` | ✓ | Create development goal |
| PUT | `/players/:playerId/development/goals/:goalId` | ✓ | Update / mark achieved |
| DELETE | `/players/:playerId/development/goals/:goalId` | ✓ | Delete development goal |
| GET | `/opponent-teams` | ✓ | List opponent teams (with player count) |
| POST | `/opponent-teams` | ✓ | Create opponent team |
| GET | `/opponent-teams/:id` | ✓ | Get opponent team |
| PUT | `/opponent-teams/:id` | ✓ | Update opponent team |
| DELETE | `/opponent-teams/:id` | ✓ | Delete opponent team |
| GET | `/opponent-teams/:id/players` | ✓ | List opponent players |
| POST | `/opponent-teams/:id/players` | ✓ | Create opponent player |
| PUT | `/opponent-teams/:id/players/:playerId` | ✓ | Update opponent player |
| DELETE | `/opponent-teams/:id/players/:playerId` | ✓ | Delete opponent player |
| GET | `/opponent-teams/:id/stats` | ✓ | Opponent tendency stats (stub — returns `{}`) |
| GET | `/scouting-reports` | ✓ | List reports |
| POST | `/scouting-reports` | ✓ | Create report |
| GET | `/scouting-reports/share/:token` | — | Public read-only report (no auth) |
| GET | `/scouting-reports/:id` | ✓ | Get report |
| PUT | `/scouting-reports/:id` | ✓ | Update report |
| DELETE | `/scouting-reports/:id` | ✓ | Delete report |
| POST | `/scouting-reports/:id/share` | ✓ | Share report (or `{ revoke:true }` to revoke) |
| GET | `/tournaments` | ✓ | List global/org tournaments (excludes team-scoped rows) |
| POST | `/tournaments` | ✓ | Create tournament |
| GET | `/tournaments/:id` | ✓ | Get tournament |
| PUT | `/tournaments/:id` | ✓ | Update tournament |
| DELETE | `/tournaments/:id` | ✓ | Delete tournament |
| GET | `/tournaments/:id/bracket` | ✓ | Bracket |
| PATCH | `/tournaments/:id/slots/:slotId` | ✓ | Update bracket slot |
| GET | `/tournaments/:id/standings` | ✓ | Standings |
| GET | `/tournaments/:id/leaders` | ✓ | Top-5 leaders per stat category (PTS/REB/AST/STL) |
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

## Database Schema (23 tables)

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
| `possession_sequences` | possessions.schema.ts |
| `settings` | settings.schema.ts |
| `push_subscriptions` | push-subscriptions.schema.ts |
| `notification_logs` | push-subscriptions.schema.ts |

## Key Domain Rules

- `stat-calculators.ts` is the single source of truth for ALL derived stats. Never compute stats inline in routes or components. This includes matchup logic: `classifyMatchupResult()` and `computeMatchupSummary()` live here, not in `analytics.routes.ts`.
- **`fga` formula:** `fga = twopm + twopa + threepm + threepa` — made shots count as attempts. Do NOT use `twopa + threepa` (miss-only) which was a historic bug.
- All DB migrations are Drizzle-managed (`npm run db:generate` → `npm run db:migrate`). Never write raw SQL migration files.
- Every entity has `id UUID PK`, `created_at`, `updated_at`, `deleted_at` (soft delete).
- Soft-delete everywhere — `deleted_at IS NULL` filter is implicit in repository queries.
- Account deletion: revokes all tokens, soft-deletes the user row, and anonymizes email to `deleted-{id}@deleted.invalid`.
- STAT_TYPE enum: `2PM | 2PA | 3PM | 3PA | FTM | FTA | OREB | DREB | AST | TO | STL | BLK | DFD | PF | TF | FF | SUB_IN | SUB_OUT | PERIOD_START | PERIOD_END | TIMEOUT`
- Shot zones are assigned by `classifyShotZone(x, y)` — x/y are normalized 0.0–1.0.
- **Skill ratings** in scouting reports are stored as JSON under the key `skillRatings`. The 10 canonical keys are: `scoring`, `ballHandling`, `passing`, `offBallMovement`, `defenseOnBall`, `defenseHelp`, `rebounding`, `athleticism`, `basketballIq`, `clutch` (all 0–10). Never add new keys without updating `SKILL_LABELS` in both `ScoutingPage.tsx` and `PlayerCardPage.tsx`.
- **Box-score endpoint** (`GET /games/:gameId/box-score`) returns per-player rows that include `playerName`, `jerseyNumber`, `teamId`, and `isHomeTeam`. Names are resolved by joining both `players` (own roster) and `opponent_players` tables. Always use these fields — never display raw `playerId` UUIDs.
- **LiveRecordingPage** tracks both teams' lineups independently. Foul bonus is API-driven: `GET /games/:gameId` returns `homeTeamFoulsThisPeriod`, `awayTeamFoulsThisPeriod`, `homeInBonus`, `awayInBonus` computed by `isTeamInBonus()`/`getTeamFoulCountForPeriod()` in `stat-calculators.ts` (`FOUL_BONUS_THRESHOLD = 5` lives in the domain, NOT the frontend; bench fouls `is_bench_foul=true` are excluded). The page also shows a possession arrow (`PossessionIndicator`, hidden when possession unknown) and a "Team Reb" control that records OREB/DREB with `playerId: null` + `isTeamRebound: true`. Substitutions go through `POST /games/:gameId/lineups`; period advance through `PATCH /games/:gameId`.
- **stat_events flags**: `is_team_rebound=true` requires `playerId` null (enforced by Zod in `recordStatEvent`); team rebounds are excluded from per-player box scores and surface as `teamOReb`/`teamDReb` (repeated on each of the team's box-score rows). `is_bench_foul=true` fouls don't count toward the team foul bonus.
- **Minutes display**: `formatMinutesPlayed(seconds, gameMaxSeconds)` (FIBA MET-1 rounding: <30s floor, ≥30s ceil, final-minute-below-max always floors) is exposed as `minutesDisplay` on box-score and season-stats rows ALONGSIDE numeric `minSeconds` — never replace the numeric field. `isDNP(events, playerId, starterPlayerIds)` flags did-not-play.
- **Shot location auto-classification**: tap location decides 2pt vs 3pt via `isThreePointArea` (spec frame, basket y=0.885) in `courtLines.tsx`; stored coords use the storage frame (basket y=0.113) — backend validates via the `isThreePointAreaCourt(x, 1−y)` adapter in `stat-calculators.ts`. Both implementations must stay formula-identical.
- **Possession tracking**: every recorded event runs `resolvePossessionChange()`; `possession_sequences` rows open/close on change. Best-effort: games vs unmanaged opponents resolve possession to `null` (FK references `teams(id)`). `GET /games/:gameId` exposes `currentPossessionTeamId`/`possessionArrowTeamId`.
- **AnalyticsDashboard** has four tabs: Season (leaders table + per-game trend chart + efficiency metrics + season box score link), Lineups (top 5-man combos + 2/3-man combo toggle from `/teams/:teamId/lineup-stats` and `/teams/:teamId/combo-stats`), Game Flow (game selector + `GameFlowChart` from `/games/:gameId/flow`), and AI Insights (`AiInsightsTab` — opponent + situation inputs → `POST /ai/lineup-recommendation/:teamId`). Lineup data only loads when the Lineups tab is active (`enabled: activeTab === 'lineup'`).
- **PlayersPage** edit modal calls `PUT /teams/:teamId/players/:id` with full player fields including `status`. Valid status values: `active`, `injured`, `hidden`, `transferred`. CSV import button triggers hidden file input → `POST /teams/:teamId/players/import` with `Content-Type: text/csv`.
- **PlayerCardPage** (`/teams/:teamId/players/:playerId`): 3-tab development section (Dev Log / Trends / Goals) below the main card. Dev Log: date+metric+value+notes entries. Trends: per-metric Recharts `LineChart` from `/players/:playerId/development/chart`. Goals: target metric/value/date, mark-achieved toggle. All three tabs are independent TanStack queries.
- **PlayerComparisonPage** (`/teams/:teamId/players/compare`): chips-style multi-selector (up to 4). 11-stat table (GP, PPG, RPG, APG, SPG, BPG, FG%, eFG%, 3P%, TS%, MIN/G); best-value cell highlighted green. Data from `/teams/:teamId/players/season-stats`.
- **Game↔tournament linking**: every `games` row has a nullable `tournament_id` FK (`ON DELETE SET NULL`). `POST /teams/:teamId/games` resolves it via the `createGame` use case (`application/games/createGame.ts`): if `tournamentId` is omitted, `ITournamentRepository.findOrCreateFriendlyForTeam(teamId)` finds-or-creates a tournament named "Friendly" scoped to that team via a nullable `tournaments.team_id` FK with a unique `(team_id, name)` index (Postgres treats NULLs as distinct, so global/org tournaments with `team_id = NULL` are unaffected). `GET /teams/:teamId/tournaments` lists a team's tournaments (always includes "Friendly", auto-created on first call). The global `GET /tournaments` (`findAll()`) excludes team-scoped rows (`team_id IS NULL` only) so per-team "Friendly" tournaments never appear in the cross-team bracket list.
- **GameSetupWizard** (`GamesPage.tsx`): 4-step modal: Step 1 (Teams — opponent name, tournament selector defaulting to the team's "Friendly" tournament, + template selector), Step 2 (Format — periods/duration/foul limits), Step 3 (Starting Lineup — home team active players as toggle buttons, max 5; posts to `/games/:id/lineups/initial` after creation, skip is allowed), Step 4 (Confirm & Create — navigates to `/games/:id/live`).
- **GamesPage** (`/teams/:teamId/games`): tournament filter dropdown (from `GET /teams/:teamId/tournaments`, "All Tournaments" default) drives `GET /teams/:teamId/games?tournamentId=`; each game card shows a tournament-name badge resolved client-side from the fetched tournaments list (omitted when `tournamentId` is null).
- **GameLogPage** (`/games/:gameId/log`): event log grouped by period. Delete with confirmation dialog. Linked from `BoxScorePage` header. Quick-edit (beyond delete) is deferred to `ActionLogModal` in Sprint S14.
- **SeasonBoxScorePage** (`/teams/:teamId/season-box-score`): sortable table with Per-Game Average / Season Totals toggle + date range filters + Per-36 toggle. Linked from AnalyticsDashboard Season tab.
- **OnOffPage** (`/teams/:teamId/analytics/on-off`): player selector dropdown, On/Off split table with PTS / OPP PTS / +/- columns and a Delta row.
- **OpponentTeamsPage** (`/opponent-teams`): CRUD list with create/edit modal (name, league, notes). Row click navigates to profile. "Add Opponent Team" modal heading; submit button is "Add Team".
- **OpponentProfilePage** (`/opponent-teams/:id`): team header + players table. Add/Edit per player (jersey, position, notes). Two independent TanStack queries (team detail + players). Optional opponent-team fields (`logo`, `homeCourt`, `contactName`, `contactEmail`) accept `null` — Zod schemas use `.optional().nullable()`.
- **stat_events `seq` column** (double precision): backfilled from `created_at` epoch. `POST /events` accepts optional `insertAfterId` to midpoint-insert between two events; precision guard prevents collisions. Never compute `seq` inline — always derived from sibling rows. The repository orders events by `period`, then `COALESCE(seq, epoch(created_at)*1000)`, then `created_at` — keep this ordering when adding queries over events.
- **`computePer36(box)`** in `stat-calculators.ts`: normalises all counting stats to 36 minutes of play. Returns `null` if `< 30` seconds played. Used by season stats API when `?per36=true`.
- **Invite token flow**: `POST /teams/:id/invitations` generates a 7-day token logged to console (no SMTP). `POST /invitations/accept` joins the team or returns `{ requiresAuth: true }` if the caller has no session. Email delivery is not yet implemented.

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
- E2E conventions: use `e2e/helpers.ts` (`createAndLogin(page)` registers a fresh user and lands on `/teams`; `setupTeam(page, name)` creates a team and returns its id). Generate a **unique email per test** (`Date.now()` + random suffix) — reusing one email across tests in a file causes flaky registration failures. Prefer role-based locators (`getByRole`) over text/index-based ones.
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

## ESLint (v9 flat config)

Both packages use ESLint 9 flat config — `eslint.config.js` at the package root using `typescript-eslint` recommended preset. The `--ext` flag has been removed from all lint scripts (invalid in ESLint 9). Pre-existing violations are set to `warn` so CI is not blocked; new code should produce zero warnings.

```bash
cd backend  && npm run lint   # uses backend/eslint.config.js
cd frontend && npm run lint   # uses frontend/eslint.config.js
```

## GitFlow

```text
main ← release/* ← develop ← feature/*
```

Current state: Phase 2 (FIBA Statistical Foundation) complete; v1.6.0 added game↔tournament linking. Released through `v1.6.0` (tagged on `main`). All releases back-merged into `develop`. Active work starts from a new `feature/*` branch off `develop`.

| Release | Sprints | Key content |
| --- | --- | --- |
| v1.1.0 | S01 | Game Setup Wizard, Period Advance Dialog, Season Box Score, Game Log, PATCH events, seq-based insertion, game templates |
| v1.2.0 | S02 | Trend stats, per-36, matchup history, combo stats, OnOff page, scoring run bands |
| v1.3.0 | S03 | ShareSheet, AI Lineup tab, PublicScoutingReportPage, tournament leaders |
| v1.4.0 | S04 | Development tracking, opponent teams/profiles, team member management, player comparison, forgot/reset password, CSV import |
| v1.4.1 | debt | ESLint 9 flat config, Drizzle snapshot regeneration, GameSetupWizard Step 3 wiring, CI/CD fixes, 30 Playwright E2E tests |
| v1.5.0 | S05+S06 | FIBA foundation: possession tracking + sequences, linked actions + cascade delete, auto 2pt/3pt classification, 14 BR-STAT validators, MET-1 minutes, team rebounds, domain foul bonus, events-route membership guard |
| v1.6.0 | — | Game↔tournament linking: `tournament_id` on `games`, per-team auto "Friendly" tournament (`tournaments.team_id` + unique index), `createGame` use case, `GET /teams/:teamId/tournaments`, tournament filter + badge on GamesPage, tournament selector on GameSetupWizard |

Never commit directly to `main` or `develop`.
