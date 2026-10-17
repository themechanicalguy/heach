# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/admin/Dockerfile -t heach-admin .

FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@heach/admin..."
RUN pnpm --filter "@heach/admin..." build

# Runtime: static files served by Caddy on 8080, as a non-root user. TLS and security headers
# are added by the Caddy reverse proxy in front (deploy/dev/Caddyfile).
FROM caddy:2.10.2-alpine AS runtime
# Patched OS packages: base image tags lag behind Alpine security fixes, which the ECR scan
# gate in Deploy dev blocks on (HIGH and CRITICAL).
RUN apk upgrade --no-cache
COPY --from=build /repo/apps/admin/dist /srv
# Non-root Caddy needs writable data and config folders.
ENV XDG_DATA_HOME=/tmp/caddy XDG_CONFIG_HOME=/tmp/caddy
USER nobody
EXPOSE 8080
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":8080"]
