# Software Portfolio Dashboard

## Overview

pnpm workspace monorepo using TypeScript. This is a full-stack engineering department portfolio dashboard where senior leadership views project status in read-only mode, while editors log in via Clerk to create/edit/delete projects, cycles, sprints, goals, and updates.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Auth**: Clerk (editors only; dashboard is public)

## Artifacts

- `artifacts/portfolio-dashboard` — React frontend, served at `/`
- `artifacts/api-server` — Express API server, served at `/api`
- `artifacts/mockup-sandbox` — Component preview dev server (Canvas only)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema (`lib/db/src/schema/`)

- `cycles.ts` — 6-week delivery cycles (name, startDate, endDate)
- `sprints.ts` — 2-week sprints nested within cycles (sprintNumber 1-3, cycleId FK)
- `goals.ts` — Business goals (name, color hex) — labeled tags on projects
- `projects.ts` — Projects with status, confidence, storyPoints, sponsor, team, blockedReason, cycleId, sprintId
- `projectGoals.ts` — Many-to-many join between projects and goals
- `projectUpdates.ts` — Timestamped update history for each project

## API Routes (`artifacts/api-server/src/routes/`)

All routes are under `/api`:
- `GET /health` — health check
- `GET /auth/me` — returns Clerk user info (isAuthenticated, isEditor, userId, email, firstName, lastName). `isEditor` is true if EDITOR_EMAILS env var is unset in dev (any auth user), or if the user's email is in the EDITOR_EMAILS allowlist.
- `GET|POST /cycles` — list / create cycles (POST requires auth)
- `PATCH|DELETE /cycles/:id` — update / delete cycle (requires auth)
- `GET|POST /sprints` — list (with optional ?cycleId filter) / create (requires auth)
- `PATCH|DELETE /sprints/:id` — update / delete sprint (requires auth)
- `GET|POST /goals` — list / create (requires auth)
- `PATCH|DELETE /goals/:id` — update / delete (requires auth)
- `GET|POST /projects` — list (with optional ?status filter) / create (requires auth)
- `GET /projects/timeline` — Gantt data: all projects with cycle/sprint/goal info
- `GET /projects/:id` — single project with goals, updates, cycle, sprint
- `PATCH|DELETE /projects/:id` — update / delete (requires auth)
- `GET|POST /projects/:projectId/updates` — list / create updates (POST requires auth)
- `DELETE /projects/:projectId/updates/:updateId` — delete update (requires auth)
- `GET /summary` — dashboard summary: counts by status, story points, capacity, active cycle

## Auth Pattern

- Public: all GET endpoints are public (no auth required)
- Protected: all write endpoints (POST/PATCH/DELETE) use `requireAuth` middleware
- Frontend: `useGetMe()` hook checks auth state; edit controls only shown when `isAuthenticated: true`
- Clerk proxy is set up at `/__clerk` via `clerkProxyMiddleware` in `app.ts`

## Project Data Model

```
Status: done | in_progress | up_next | backlog | blocked | new_request
Confidence: high | medium | low | at_risk
```

Sprints nest inside Cycles: 3 sprints per cycle, 2 weeks each, cycle = 6 weeks.

## Seed Data

Database includes:
- 4 cycles (Q1 2026 through Q2/Q3 2026), 12 sprints
- 6 business goals (Platform Reliability, Customer Growth, Cost Optimisation, Developer Productivity, Data & Analytics, Security & Compliance)
- 20 realistic projects spread across all statuses
- 14 timestamped project updates

## Frontend Views (`artifacts/portfolio-dashboard/src/`)

- **Dashboard** (`/`) — summary metrics bar + tabs: Kanban / Timeline (Gantt) / List (Pipeline)
- **Kanban** — columns per status, project cards with confidence badges, sponsor, team, update snippets, goal tags
- **Timeline** — SVG Gantt chart, full 12-month range with project bars
- **List/Pipeline** — information-dense scrollable list of all projects
- **Project Modal** — full project detail, update history, edit form (editor only)
- **Admin Panel** — manage cycles, sprints, goals (editor only, accessible from header)
- `/sign-in` — Clerk-styled sign-in page
- `/sign-up` — Clerk sign-up page

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
