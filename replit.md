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
- **Auth**: Clerk (editors only; site protected by optional passcode gate)

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

## Pre-push Hook (Codegen)

A Husky pre-push hook is configured at `.husky/pre-push`. It runs `pnpm --filter @workspace/api-spec run codegen` before every push to ensure generated API client files are up to date with `openapi.yaml`.

**To bypass in an emergency:**
```
SKIP_TYPECHECK=1 git push
```
This prints a visible warning and skips the codegen step entirely. Use only when strictly necessary (e.g., pushing a WIP branch for remote backup, or an emergency hotfix). Never leave `SKIP_TYPECHECK=1` as a permanent alias — it defeats the safety net.

## Pre-commit Hook (Codegen Drift Check)

A Husky pre-commit hook is configured at `.husky/pre-commit`. It runs `scripts/check-codegen-drift.sh` before every commit, blocking the commit if generated files are out of sync with `openapi.yaml`.

**Setup (after cloning or after `pnpm install`):**

The hook is installed automatically when you run `pnpm install` (via the `prepare` script). No manual steps needed.

**If the commit is blocked:**
1. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate the API client.
2. Stage the updated generated files.
3. Re-attempt your commit.

**To bypass in an emergency (not recommended):**
```
SKIP_TYPECHECK=1 git commit
```
This prints a visible warning and skips the drift check entirely. You can also use the standard Git flag:
```
git commit --no-verify
```

## Database Schema (`lib/db/src/schema/`)

- `cycles.ts` — 6-week delivery cycles (name, startDate, endDate)
- `sprints.ts` — 2-week sprints nested within cycles (sprintNumber 1-3, cycleId FK)
- `goals.ts` — Business goals (name, color hex) — labeled tags on projects
- `projects.ts` — Projects with status, confidence, storyPoints, sponsor, team, blockedReason, cycleId, sprintId
- `projectGoals.ts` — Many-to-many join between projects and goals
- `projectUpdates.ts` — Timestamped update history for each project
- `emailSchedule.ts` — Single-row config for weekly email reports (enabled, dayOfWeek, hour, recipients, lastSentAt)

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
- `GET /email-schedule` — get email report schedule settings (requires auth)
- `PATCH /email-schedule` — update email schedule (enabled, dayOfWeek, hour, recipients) (requires auth)
- `POST /email-schedule/send-now` — trigger immediate report email to all configured recipients (requires auth)

## Auth Pattern

- **Passcode gate**: `PasscodeGate` component wraps the entire frontend. Reads `VITE_SITE_PASSCODE` env var; if set, shows a passcode prompt before any content. Unlocked state stored in `sessionStorage` (key: `delivery_dashboard_unlocked`). If env var is not set, gate is bypassed entirely.
- Public: all GET endpoints are public (no auth required)
- Protected: all write endpoints (POST/PATCH/DELETE) use `requireAuth` middleware
- Frontend: `useGetMe()` hook checks auth state; edit controls only shown when `isAuthenticated: true`
- Clerk proxy is set up at `/__clerk` via `clerkProxyMiddleware` in `app.ts`

## Environment Variables (Frontend)

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk pub key; if absent, app runs in read-only mode
- `VITE_CLERK_PROXY_URL` — Clerk proxy URL (auto-set by Replit)
- `VITE_SITE_PASSCODE` — optional site-wide passcode gate; if unset, gate is disabled

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
- **Admin Panel** — manage cycles, sprints, goals, and email report schedule (editor only, accessible from header)
- `/sign-in` — Clerk-styled sign-in page
- `/sign-up` — Clerk sign-up page

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
