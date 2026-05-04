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

## Running locally

### Prerequisites

- **Node.js 24** — [nodejs.org](https://nodejs.org/)
- **pnpm 10** — `npm install -g pnpm@10`
- **Docker & Docker Compose** *(only needed for the Docker path)* — [docs.docker.com](https://docs.docker.com/get-docker/)

You'll also need a [Clerk](https://clerk.com/) application to supply the `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` values below.

---

### Option A — Docker (recommended)

Docker starts Postgres, applies the schema, runs the API server, and launches the frontend dev server in one command.

```bash
# 1. Copy the example env file and fill in your values
cp .env.example .env

# 2. Open .env and set at minimum:
#    CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, EDITOR_EMAILS

# 3. Start everything
docker-compose up
```

The frontend is available at **http://localhost:5173** and the API at **http://localhost:3000**.

Both services support hot-reload out of the box:
- **Frontend** (`web`) — Vite HMR picks up React/CSS changes instantly.
- **API** (`api`) — `tsx watch` monitors TypeScript source files and restarts the server automatically on every save.

To rebuild the Docker image after adding or removing npm packages:

```bash
docker-compose up --build api
```

---

### Option B — Plain Node / pnpm

Run each service directly without Docker. You'll need a running Postgres instance (local or remote).

```bash
# 1. Install dependencies
pnpm install

# 2. Push the database schema (first run and after schema changes)
DATABASE_URL=postgres://user:password@localhost:5432/portfolio \
  pnpm --filter @workspace/db run push
```

**Terminal 1 — API server** (port 3000):

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/portfolio
export CLERK_SECRET_KEY=sk_test_replace_me
export EDITOR_EMAILS=you@example.com
export PORT=3000
pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend dev server** (port 5173):

```bash
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
export VITE_SITE_PASSCODE=          # leave blank to disable the passcode gate
export PORT=5173                    # required by vite.config.ts
export BASE_PATH=/                  # required by vite.config.ts
pnpm --filter @workspace/tech-dashboard run dev
```

The frontend is available at **http://localhost:5173** and the API at **http://localhost:3000**.

---

### Environment variable reference

See [`.env.example`](.env.example) for a full list of variables with descriptions and example values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for the browser |
| `EDITOR_EMAILS` | Yes | Comma-separated list of editor email addresses |
| `BASE_PATH` | Yes | Vite base path — use `/` locally |
| `VITE_TD_SITE_PASSCODE` | No | Passcode gate for the dashboard (blank = disabled) |
| `TD_ADMIN_ACCOUNTS` | Yes | JSON array of admin accounts (`[{"username","password","firstName","lastName","role"}]`) |
| `TD_ADMIN_SESSION_SECRET` | Yes | HMAC secret for signing admin session cookies (32+ bytes) |
| `PORT` | No | API server port (default `3000`) |
| `ALLOWED_ORIGINS` | No | CORS origins (default `http://localhost:5173`) |
| `LOG_LEVEL` | No | API log level (default `info`) |
| `VITE_API_BASE_URL` | No | API base URL as seen by the browser (default `http://localhost:3000`) |

## Key commands

| Command | Description |
|---|---|
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |

## CI

The **Codegen Drift Check** workflow (`.github/workflows/codegen-drift.yml`) runs on every pull request and blocks merge if the generated API client files are out of sync with `openapi.yaml`. The badge at the top of this file shows the current status on `main`.
