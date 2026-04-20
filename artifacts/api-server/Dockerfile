# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ── Stage 2: install all dependencies (prod + dev) ────────────────────────────
FROM base AS deps

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json               ./lib/db/
COPY lib/                              ./lib/
COPY scripts/package.json             ./scripts/

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
# Running from /app root lets tsx resolve workspace packages correctly.
CMD ["sh", "-c", \
     "pnpm install --frozen-lockfile && \
      pnpm exec tsx watch artifacts/api-server/src/index.ts"]

# ── Stage 4: build ────────────────────────────────────────────────────────────
FROM deps AS build

COPY . .

RUN pnpm --filter @workspace/api-server run build

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

COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist

WORKDIR /app/artifacts/api-server

EXPOSE 3000

ENV PORT=3000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
