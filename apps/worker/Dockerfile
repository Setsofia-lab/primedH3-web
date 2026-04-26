# syntax=docker/dockerfile:1.7
#
# PrimedHealth worker — multi-stage build.
#  builder: Node 22 + pnpm, full workspace install, tsc build,
#           then `pnpm deploy --prod` to emit a minimal bundle.
#  runtime: distroless nodejs22 (no shell, no package manager).
#
# Build from the repository root:
#   docker build -f apps/worker/Dockerfile -t primedhealth/worker:dev .

##############################
# stage 1 — build
##############################
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

# Prime the dep cache with manifests only.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/agent-contracts/package.json packages/agent-contracts/
COPY packages/ui/package.json packages/ui/
COPY infra/cdk/package.json infra/cdk/

RUN pnpm install --frozen-lockfile

# Copy only what the worker needs.
COPY apps/worker apps/worker
COPY packages/shared-types packages/shared-types

RUN pnpm --filter @primedhealth/worker build

# Emit a self-contained production bundle to /out.
RUN pnpm --filter @primedhealth/worker --prod --legacy deploy /out

##############################
# stage 2 — runtime
##############################
FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json
# pnpm deploy respects .gitignore which excludes dist/, so copy the
# nest-build output directly (same trick the api Dockerfile uses).
COPY --from=builder /repo/apps/worker/dist ./dist

USER nonroot
ENV NODE_ENV=production

# No EXPOSE — the worker is SQS-driven, no HTTP listener.

CMD ["dist/main.js"]
