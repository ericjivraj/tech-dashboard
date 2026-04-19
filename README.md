# Software Portfolio Dashboard

[![Codegen Drift Check](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/actions/workflows/codegen-drift.yml/badge.svg)](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/actions/workflows/codegen-drift.yml)

A full-stack engineering department portfolio dashboard. Senior leadership views project status in read-only mode, while editors log in via Clerk to create, edit, and delete projects, cycles, sprints, goals, and updates.

## Stack

- **Monorepo**: pnpm workspaces
- **Runtime**: Node.js 24
- **Language**: TypeScript 5.9
- **API**: Express 5 + OpenAPI / Orval codegen
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Auth**: Clerk (editors only)

## Getting started

```bash
pnpm install
pnpm run build
```

## Key commands

| Command | Description |
|---|---|
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |

## CI

The **Codegen Drift Check** workflow (`.github/workflows/codegen-drift.yml`) runs on every pull request and blocks merge if the generated API client files are out of sync with `openapi.yaml`. The badge at the top of this file shows the current status on `main`.
