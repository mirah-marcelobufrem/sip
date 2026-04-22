# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is a greenfield project. No application source code exists yet — only git config, agent definitions, and `.gitignore` conventions are in place.

## Intended Stack (inferred from agent definitions and .gitignore)

| Layer | Technology |
|---|---|
| Reverse proxy | nginx |
| Workflow automation | n8n |
| Backend | Node.js / Express.js / TypeScript |
| Database | PostgreSQL |
| Frontend | React 18 / TypeScript / CSS Modules |
| Containerization | Docker Compose |
| CI/CD | GitHub Actions |

## Infrastructure Conventions

**nginx config generation** — `nginx/n8n.conf` is generated (not committed). Always regenerate it before building:

```bash
bash scripts/generate-nginx-conf.sh
```

**Local scratch space** — place exploratory files, temporary outputs, and local-only notes in `local/` or `.work/`. Both are gitignored.

**Secrets** — never commit `.env`. Copy from `.env.example` if it exists; create one if scaffolding a new service.

## Agent System

Custom agent definitions live in `.claude/agents/` (gitignored — local only). Available agents:

| File | Role |
|---|---|
| `engineering-backend-architect.md` | System design, DB schema, API architecture |
| `engineering-frontend-developer.md` | React/TypeScript UI, performance, accessibility |
| `engineering-software-architect.md` | ADRs, bounded contexts, trade-off analysis |
| `engineering-senior-developer.md` | Laravel/Livewire/FluxUI premium implementation |
| `engineering-devops-automator.md` | Docker, CI/CD, cloud infrastructure |
| `design-ui-designer.md` | Design tokens, component libraries, WCAG compliance |
| `automation-governance-architect.md` | n8n workflow governance and approval |
| `testing-api-tester.md` | API validation and integration testing |
| `testing-reality-checker.md` | Evidence-based production readiness gating |

Invoke via `@agent-name` in Claude Code or use the Agent tool with the matching `subagent_type`.

## n8n Workflow Conventions

All production workflows must follow the 10-stage pipeline defined in `automation-governance-architect.md`:

`Trigger → Validation → Normalization → Business Logic → External Actions → Result Validation → Logging → Error Branch → Fallback → Completion`

Naming: `[ENV]-[SYSTEM]-[PROCESS]-[ACTION]-v[MAJOR.MINOR]`  
Example: `PROD-CRM-LeadIntake-CreateRecord-v1.0`

## Architecture Guardrails

- All DB migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
- Schema changes go inside the existing `initDB()` — no new migration files
- CSS always uses design tokens via `var(--token)` — no hardcoded colors, shadows, or radius values
- Frontend never imports from `infrastructure/` or `domain/` — only calls use cases via props
