# SIP Scout

Basketball intelligence app — live stat tracking + player & opponent scouting.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS v4, TanStack Query v5, React Router v7 |
| Backend | Express 5, Node.js 22 LTS, TypeScript strict |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM + Drizzle Kit |
| Auth | JWT (jose) + bcrypt |
| Container | Docker Compose |
| CI/CD | GitHub Actions |

## Quick Start (Docker Desktop)

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env (required for AI features only)

docker compose up
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API health: http://localhost:3001/health

## Local Development (without Docker)

**Prerequisites:** Node.js 22, PostgreSQL 17 running locally.

```bash
# Backend
cd backend
cp .env.example .env          # edit DATABASE_URL if needed
npm install
npm run db:migrate
npm run dev                   # http://localhost:3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## Database Migrations

```bash
cd backend
npm run db:generate   # generate migration from schema changes
npm run db:migrate    # apply pending migrations
npm run db:studio     # open Drizzle Studio (visual DB explorer)
```

## Testing

```bash
# Backend
cd backend
npm run test:unit         # unit tests (no DB required)
npm run test:integration  # integration tests (requires PostgreSQL)
npm run test:coverage     # coverage report

# Frontend
cd frontend
npm test                  # Vitest
```

## Project Structure

```
sip/
├── backend/
│   └── src/
│       ├── domain/          # Entities, repository interfaces, stat calculators
│       ├── application/     # Use cases (one function per use case)
│       ├── infrastructure/  # Drizzle repositories, JWT, storage
│       └── presentation/    # Express routes, middleware
├── frontend/
│   └── src/
│       ├── components/      # Shared UI: AppShell, ShotChart, etc.
│       ├── features/        # Page-level feature modules
│       ├── lib/             # API client
│       └── store/           # Zustand stores
├── nginx/                   # nginx config template + generator script
├── docker-compose.yml       # Local development
└── docker-compose.prod.yml  # Production (AWS-ready)
```

## Architecture

Clean Architecture with four layers:

```
domain → application → infrastructure → presentation
```

- **domain**: zero dependencies; entities, repository interfaces, stat calculators
- **application**: use cases; imports only domain interfaces
- **infrastructure**: Drizzle implementations, JWT, file storage; imports domain
- **presentation**: Express routes; calls use cases; never touches DB directly

## AWS Migration

The app is AWS-ready with zero code changes:

1. Swap `docker-compose.prod.yml` → ECS Task Definitions or EC2 + Docker
2. Replace `STORAGE_PATH` local storage → S3 (`multer-s3`)
3. Replace `.env` secrets → AWS Secrets Manager / Parameter Store
4. Replace `postgres` container → RDS PostgreSQL 17 (schema identical)
5. Add CloudFront CDN in front of the nginx/static assets

## Development Waves

See [.work/plan.txt](.work/plan.txt) for the full sprint plan.

| Wave | Sprints | Scope |
|---|---|---|
| 1 | 1–2 | Auth, Teams, Players, Opponent Management |
| 2 | 3–4 | Live Stat Recording, Shot Charts, Box Scores |
| 3 | 5–6 | Season Analytics, Lineup Analysis, Game Flow |
| 4 | 7–8 | Scouting Reports, Player Cards, Development Tracking |
| 5 | 9–10 | Tournaments, AI Features, Export |
| 6 | 11–12 | PWA/Offline, Notifications, Settings, Production Hardening |

## Environment Variables

Copy `.env.example` to `.env` and fill in values. Required for production:

```
JWT_SECRET            256-bit random string
JWT_REFRESH_SECRET    256-bit random string (different from above)
ANTHROPIC_API_KEY     For AI features only (optional for non-AI use)
```

## Contributing

This project follows [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/).

```bash
git checkout develop
git checkout -b feature/your-feature-name
# ... implement ...
# open PR → develop
```

CI runs on every push: TypeScript check, lint, unit tests, integration tests, and build.
