# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/api/Dockerfile -t heach-api .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# Install all workspace dependencies from the lockfile only.
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@heach/api..."
RUN pnpm --filter "@heach/api..." --filter "!@heach/types" build \
 && pnpm --filter @heach/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r apps/api/migrations apps/api/sql /out/

# Runtime: production dependencies and compiled output only, as the non-root node user.
FROM node:24-alpine AS runtime
# Patched OS packages: base image tags lag behind Alpine security fixes, which the ECR scan
# gate in Deploy dev blocks on (HIGH and CRITICAL).
RUN apk upgrade --no-cache
ENV NODE_ENV=production API_PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
COPY --from=build --chown=node:node /out/migrations ./migrations
COPY --from=build --chown=node:node /out/sql ./sql
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT}/healthz" >/dev/null || exit 1
CMD ["node", "--import", "./dist/telemetry.js", "dist/main.js"]
