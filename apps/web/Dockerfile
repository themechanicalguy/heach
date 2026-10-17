# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/web/Dockerfile -t heach-web .

FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@heach/web..."
RUN pnpm --filter "@heach/web..." build

# Runtime: Next.js standalone server only, as the non-root node user.
FROM node:24-alpine AS runtime
# Patched OS packages: base image tags lag behind Alpine security fixes, which the ECR scan
# gate in Deploy dev blocks on (HIGH and CRITICAL).
RUN apk upgrade --no-cache
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# Service worker, web manifest and icons (PF-07).
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
