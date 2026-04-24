# syntax=docker/dockerfile:1.7
#
# PrimedHealth api — multi-stage build.
#
#  builder: Node 22 + pnpm, full workspace install, nest build,
#           then `pnpm deploy --prod` to emit a minimal bundle.
#
#  runtime: distroless nodejs22 (no shell, no package manager) for
#           the smallest attack surface. Runs as non-root.
#
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t primedhealth/api:dev .

##############################
# stage 1 — build
##############################
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

# Prime the dep cache: copy only manifests first.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/agent-contracts/package.json packages/agent-contracts/
COPY packages/ui/package.json packages/ui/
COPY infra/cdk/package.json infra/cdk/

RUN pnpm install --frozen-lockfile

# Copy only what the api actually needs to compile.
COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
COPY packages/agent-contracts packages/agent-contracts

RUN pnpm --filter @primedhealth/api build

# Deploy emits a self-contained production bundle at /out with just
# the production dep graph. --legacy is required on pnpm v10+ for
# non-injected workspaces.
RUN pnpm --filter @primedhealth/api --prod --legacy deploy /out

##############################
# stage 2 — runtime
##############################
FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app
# Runtime deps from `pnpm deploy` (minimal, prod-only tree).
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json
# Compiled JS from the nest build step directly — `pnpm deploy`
# respects .gitignore, which excludes dist/ from the emitted bundle,
# so we copy from the source build output instead.
COPY --from=builder /repo/apps/api/dist ./dist

USER nonroot
ENV NODE_ENV=production
EXPOSE 3001

CMD ["dist/main.js"]
