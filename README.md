# SIP Scout

Basketball intelligence app — live stat tracking, player & opponent scouting, and tournament management.

> **v1.4.1** — Phase 1 (S01–S04) complete. Phase 2 (FIBA Statistical Foundation) next.

## Features

### Live Recording & Game Management

- **Live stat recording** — 2-tap entry for any stat, both teams tracked at player level
- **Game Setup Wizard** — 4-step modal: opponent, format, starting lineup, confirm & create
- **Period advance dialog** — score confirmation before advancing the period
- **Game event log** — chronological event log per game, grouped by period, with delete
- **Shot charts** — custom SVG half-court with zone analysis and heat maps

### Analytics

- **Season analytics** — sortable season box score (per-game and totals), lineup rankings, on/off analysis, efficiency metrics
- **Per-36 stats** — normalised counting stats for fair cross-player comparison
- **Trend charts** — per-stat per-game trend lines (PTS/REB/AST/STL/BLK/TO)
- **Matchup history** — win/loss record and game results vs a named opponent
- **Lineup combos** — 2-man and 3-man combination +/- analysis
- **Game flow chart** — score differential over time with scoring run bands

### Scouting & Development

- **Opponent profiles** — persistent opponent team + player rosters with notes
- **Scouting reports** — structured player/team assessments with skill radar charts (10 axes)
- **Shareable reports** — public token-gated share link; revocable at any time
- **Player development** — longitudinal tracking (Dev Log, Trends, Goals) with milestone notifications
- **Player comparison** — side-by-side stats for up to 4 players

### Team Management

- **Team member management** — role changes, member removal, invite-by-token flow
- **CSV player import** — bulk import from spreadsheet (firstName, lastName, jersey, position, …)
- **Forgot / reset password** — token-based flow (1-hour expiry, no info leakage)

### Tournaments & Sharing

- **Tournament management** — single/double-elimination and round-robin brackets
- **Public bracket pages** — shareable without login (`/bracket/:token`)
- **Tournament leaders** — top-5 PTS/REB/AST/STL widget on the bracket page

### AI (Anthropic Claude)

- **Game recaps** — narrative summary generated after each game
- **Scouting assistant** — AI analysis from scouting report data
- **Lineup recommendations** — opponent + situation → optimal lineup suggestion
- **Development insights** — per-player growth recommendations

### Platform

- **Export** — CSV, PDF (Puppeteer), JSON for all major views; share sheet with WhatsApp/Email/Copy
- **PWA** — installable, works offline with IndexedDB queue; auto-syncs on reconnect
- **Push notifications** — Web Push (VAPID) for game recaps, milestones, and invitations
- **LGPD/GDPR compliant** — full data export (JSON download) and account deletion

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 6 + Tailwind CSS v4 |
| State | TanStack Query v5 (server) + Zustand v5 (client) |
| Routing | React Router v7 |
| Charts | Recharts + custom SVG shot chart + SVG radar chart |
| Backend | Express 5 + Node.js 22 LTS + TypeScript strict |
| ORM | Drizzle ORM + Drizzle Kit |
| Auth | JWT (jose) + bcrypt — 15 min access / 7 day refresh |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| PDF export | Puppeteer (headless) |
| Push notifications | Web Push (VAPID) |
| Database | PostgreSQL 17 (22 tables) |
| Container | Docker Compose (dev) + docker-compose.prod.yml (production) |
| Proxy | nginx (production, with Let's Encrypt SSL) |
| CI/CD | GitHub Actions — runs on every push; E2E auto-triggers on `develop`/`feature/*`/`main` |
| E2E tests | Playwright (30 tests across auth, forgot-password, navigation, teams, players, games, box score, opponents, settings/account) |

## Quick Start (Docker Desktop)

```bash
cp .env.example .env          # fill in JWT_SECRET, JWT_REFRESH_SECRET
bash start.sh                 # health-check-aware startup (recommended)
bash start.sh --build         # force full image rebuild
# or: docker compose up
```

App is available at:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3001/api/v1>
- Health check: <http://localhost:3001/health>
- Drizzle Studio: run `cd backend && npm run db:studio` separately → <http://localhost:4983> (not started by Docker)

> `start.sh` polls postgres health, builds with `--no-cache` when `--build` is passed, and waits up to 3 minutes for the backend before printing a ready banner. Use `stop.sh --clean-all` to wipe everything including the database volume.

## Development (without Docker)

```bash
# Backend
cd backend
npm install
npm run db:migrate            # requires a local postgres:17
npm run dev                   # http://localhost:3001

# Frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## Common Commands

```bash
# Schema changes
cd backend && npm run db:generate   # generates migration from schema (compile first)
cd backend && npm run db:migrate    # applies pending migrations
cd backend && npm run db:studio     # Drizzle Studio GUI

# Tests
cd backend && npm run test:unit
cd backend && npm run test:integration   # requires running postgres
cd frontend && npm test                  # Vitest
cd frontend && npx playwright test       # E2E (requires running stack)

# Lint + type checks
cd backend  && npm run lint && npm run typecheck
cd frontend && npm run lint && npm run typecheck

# nginx config (production)
DOMAIN=yourdomain.com bash nginx/generate-nginx-conf.sh
```

## Push Notifications (VAPID setup)

Generate VAPID keys once and store them as secrets:

```bash
npx web-push generate-vapid-keys
```

Add to `.env` (dev) or GitHub Secrets / AWS Secrets Manager (prod):

```
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

Push notifications silently no-op when these keys are absent — the app runs normally without them.

## Production Deployment

> **Note:** AWS infrastructure is not yet provisioned. The deploy workflow (`deploy.yml`) is set to `workflow_dispatch` only — it will not trigger automatically. Re-enable auto-deploy by switching the trigger back to `on: push: branches: [main]` once infrastructure is ready.

```bash
# Generate nginx config with SSL
DOMAIN=yourdomain.com bash nginx/generate-nginx-conf.sh

# First run: bootstrap SSL with certbot
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot -d yourdomain.com \
  --email admin@yourdomain.com --agree-tos --no-eff-email

# Start the stack
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d

# Apply migrations
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate
```

**Required secrets** (set as environment variables or in a `.env.prod` file):

| Variable | Description |
|---|---|
| `POSTGRES_USER` | DB username |
| `POSTGRES_PASSWORD` | DB password (strong) |
| `POSTGRES_DB` | DB name |
| `JWT_SECRET` | 256-bit random string |
| `JWT_REFRESH_SECRET` | 256-bit random string |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `FRONTEND_URL` | `https://yourdomain.com` |
| `VAPID_PUBLIC_KEY` | From `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | From `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:admin@yourdomain.com` |

## AWS Migration Path

Zero application code changes required:

| Local | AWS |
|---|---|
| `docker-compose.prod.yml` | ECS Task Definitions or EC2 + Docker |
| Local file storage | `multer-s3` + S3 bucket |
| `.env` secrets | AWS Secrets Manager / Parameter Store |
| `postgres` container | RDS PostgreSQL 17 |
| nginx | CloudFront CDN + ALB |

## Architecture

Clean Architecture (Hexagonal) — strict layer boundaries:

```text
domain/ → application/ → infrastructure/ → presentation/
```

- **`domain/`** — entities, repository interfaces, `stat-calculators.ts` (all derived stats). Zero external imports.
- **`application/`** — dedicated use-case files for auth and live game recording (one exported async function per file, domain-only imports, dependencies injected as parameters); other business logic currently lives inline in route files. Every use case calls `Schema.parse()` internally so Zod validation runs regardless of the caller.
- **`infrastructure/`** — Drizzle schema + repositories, auth (JWT/bcrypt), AI client, Puppeteer PDF, Web Push service.
- **`presentation/`** — Express routes, auth middleware (`req.userId`, `req.userRole`), error middleware.

Frontend follows feature-sliced modules — features never import from each other, only through shared `lib/`, `hooks/`, and `store/`.

## Delivery History

| Release | Content |
| --- | --- |
| v1.1.0 (S01) | Game Setup Wizard, Period Advance Dialog, Season Box Score, Game Log + PATCH events, seq-based event insertion, game templates |
| v1.2.0 (S02) | Trend stats, per-36, date filters, matchup history, combo stats, On/Off page, scoring run bands |
| v1.3.0 (S03) | ShareSheet, AI Lineup tab, Public Scouting Report page, tournament leaders widget |
| v1.4.0 (S04) | Development tracking (Log/Trends/Goals), opponent teams/profiles, team member management + invite, player comparison, forgot/reset password, CSV player import |
| v1.4.1 (debt) | ESLint 9 flat config, Drizzle snapshot regeneration, GameSetupWizard Step 3, CI/CD fixes, 30 Playwright E2E tests |

## GitFlow

```text
main ← release/* ← develop ← feature/*
```

Active development starts from a new `feature/*` branch off `develop`. Never commit directly to `main` or `develop`. All CI checks must pass before merge.

## License

Private — © 2026 SIP Scout
