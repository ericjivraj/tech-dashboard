# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ── Stage 2: install all dependencies (prod + dev) ────────────────────────────
FROM base AS deps

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/api-server/package.json         ./artifacts/api-server/
COPY artifacts/tech-dashboard/package.json ./artifacts/tech-dashboard/
COPY lib/                                       ./lib/
COPY scripts/package.json                       ./scripts/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 3: dev-server (local development with tsx hot-reload) ───────────────
#
# Source files are NOT copied here — docker-compose bind-mounts the repo at
# /app so that file edits on the host are immediately visible inside the
# container. tsx watch detects changes and restarts the server automatically.
FROM deps AS dev-server

ENV NODE_ENV=development

EXPOSE 3000

# tsx is a devDependency of @workspace/api-server (catalog reference).
# Use --filter so pnpm runs inside the api-server workspace and resolves its
# local .bin/tsx.
CMD ["sh", "-c", \
     "pnpm install --frozen-lockfile && \
      pnpm --filter @workspace/api-server exec tsx watch src/index.ts"]

# ── Stage 4: build ────────────────────────────────────────────────────────────
#
# Builds both the api-server bundle (esbuild) and the tech-dashboard
# static assets (Vite). The dashboard's dist/public is copied into the api
# image's public/ folder in the production stage and served via express.static.
#
# PORT and BASE_PATH are required by vite.config.ts at config-load time even
# for `vite build`. The values aren't used at build time — PORT only affects
# the dev/preview server, and BASE_PATH controls the public URL base.
FROM deps AS build

ENV PORT=3000
# BASE_PATH is baked into the Vite bundle (asset URLs and BASE_URL) so the
# dashboard works when served under https://innovate.bonhams.com/tech-dashboard/
# in both preprod and production. Traefik strips the prefix before forwarding
# to the api, so app.ts stays at root (/api, /health, /).
ENV BASE_PATH=/tech-dashboard

COPY . .

RUN pnpm --filter @workspace/api-server --filter @workspace/tech-dashboard run build

# ── Stage 5: production ───────────────────────────────────────────────────────
FROM node:24-slim AS production

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json               ./lib/db/
COPY lib/                              ./lib/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

COPY --from=build /app/artifacts/api-server/dist                  ./artifacts/api-server/dist
COPY --from=build /app/artifacts/tech-dashboard/dist/public  ./artifacts/api-server/public

WORKDIR /app/artifacts/api-server

EXPOSE 3000

ENV PORT=3000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
