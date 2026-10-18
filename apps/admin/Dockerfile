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

# Caddy rebuilt from source with patched Go and golang.org/x/net: the official 2.11.x images carry
# HIGH CVEs in their Go build (SO-03.1 container scan). Same Caddy version, no extra modules.
# This image also runs the edge proxy on the dev host (deploy/dev/compose.yml).
# Cross-compiled on the build machine: fast even when the target is arm64 (dev host).
FROM --platform=$BUILDPLATFORM caddy:2.11.6-builder-alpine AS caddy
ARG TARGETARCH
ENV GOTOOLCHAIN=go1.26.9 GOOS=linux GOARCH=$TARGETARCH CGO_ENABLED=0
RUN xcaddy build v2.11.6 --replace golang.org/x/net=golang.org/x/net@v0.60.0 --output /usr/bin/caddy

# Runtime: static files served by Caddy on 8080, as a non-root user. TLS and security headers
# are added by the Caddy reverse proxy in front (deploy/dev/Caddyfile).
FROM caddy:2.11.6-alpine AS runtime
# Patched OS packages: base image tags lag behind Alpine security fixes, which the ECR scan
# gate in Deploy dev blocks on (HIGH and CRITICAL).
RUN apk upgrade --no-cache
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY --from=build /repo/apps/admin/dist /srv
# Non-root Caddy needs writable data and config folders.
ENV XDG_DATA_HOME=/tmp/caddy XDG_CONFIG_HOME=/tmp/caddy
USER nobody
EXPOSE 8080
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":8080"]
