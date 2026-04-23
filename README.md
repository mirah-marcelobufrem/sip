# SIP Scout

Basketball intelligence app — live stat tracking, player & opponent scouting, and tournament management.

## Features

- **Live stat recording** — 2-tap entry for any stat, both teams tracked at player level
- **Shot charts** — custom SVG half-court with zone analysis and heat maps
- **Season analytics** — box scores, lineup rankings, on/off analysis, efficiency metrics
- **Opponent scouting** — persistent opponent profiles with accumulated stats and tendencies
- **Scouting reports** — structured player/team assessments with skill radar charts
- **Player development** — longitudinal tracking with goals and milestone notifications
- **Tournament management** — single/double-elimination and round-robin brackets with shareable public bracket pages
- **AI features** — game recaps, scouting assistant, lineup recommendations (Anthropic Claude)
- **Export** — CSV, PDF (Puppeteer), JSON for all major views
- **PWA** — installable, works offline with IndexedDB queue; auto-syncs on reconnect
- **Push notifications** — Web Push (VAPID) for game recaps, milestones, and invitations
- **LGPD/GDPR compliant** — full data export (JSON download) and account deletion

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 6 + Tailwind CSS v4 |
| State | TanStack Query v5 (server) + Zustand v5 (client) |
| Routing | React Router v7 |
| Charts | Recharts + custom SVG shot chart |
| Backend | Express 5 + Node.js 22 LTS + TypeScript strict |
| ORM | Drizzle ORM + Drizzle Kit |
| Auth | JWT (jose) + bcrypt — 15 min access / 7 day refresh |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| PDF export | Puppeteer (headless) |
| Push notifications | Web Push (VAPID) |
| Database | PostgreSQL 17 (22 tables) |
| Container | Docker Compose (dev) + docker-compose.prod.yml (production) |
| Proxy | nginx (production, with Let's Encrypt SSL) |
| CI/CD | GitHub Actions (CI + deploy + Playwright E2E) |
| E2E tests | Playwright |

## Quick Start (Docker Desktop)

```bash
cp .env.example .env          # fill in JWT_SECRET, JWT_REFRESH_SECRET
docker compose up
```

App is available at:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3001/api/v1>
- Health check: <http://localhost:3001/health>

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
cd backend && npm run db:generate   # generates migration from schema
cd backend && npm run db:migrate    # applies pending migrations

# Tests
cd backend && npm run test:unit
cd backend && npm run test:integration
cd frontend && npm test
cd frontend && npx playwright test  # E2E (requires running stack)

# Type checks
cd backend && npm run typecheck
cd frontend && npm run typecheck

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
- **`application/`** — one use case per file, domain-only imports, dependencies injected as parameters. Every use case calls `Schema.parse()` internally so Zod validation runs regardless of the caller.
- **`infrastructure/`** — Drizzle schema + repositories, auth (JWT/bcrypt), AI client, Puppeteer PDF, Web Push service.
- **`presentation/`** — Express routes, auth middleware (`req.userId`, `req.userRole`), error middleware.

Frontend follows feature-sliced modules — features never import from each other, only through shared `lib/`, `hooks/`, and `store/`.

## GitFlow

```text
main ← release/* ← develop ← feature/*
```

Never commit directly to `main` or `develop`. All CI checks must pass before merge.

## License

Private — © 2026 SIP Scout
