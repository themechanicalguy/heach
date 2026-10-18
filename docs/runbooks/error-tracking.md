# Front-end error tracking and the metrics dashboard (local)

GlitchTip, Prometheus and Grafana run only on a developer machine or in CI (ADR 0010); the dev
host writes errors and metrics to its logs. Everything here uses synthetic data.

## Start

```sh
pnpm setup                                   # adds GLITCHTIP_*, GRAFANA_* secrets to .env
docker compose --profile observability up -d # Prometheus, Grafana, GlitchTip (+ its PostgreSQL)
```

| Service | URL | Sign-in |
| --- | --- | --- |
| Grafana, dashboard "HEACH API (LM-05.1)" | http://localhost:3300 | `admin`, `GRAFANA_ADMIN_PASSWORD` from `.env` |
| Prometheus | http://localhost:9090 | none, loopback only |
| GlitchTip | http://localhost:8000 | create a user: `docker compose exec glitchtip ./manage.py createsuperuser` |

## LM-05.1: request rate, error rate and latency on one dashboard

Run the API with `OTEL_EXPORTER_OTLP_ENDPOINT` set (the default in `.env`) and send it traffic.
The dashboard reads `http_server_request_duration_seconds` from the Collector through Prometheus:
request rate, 5xx share, and p50, p95 and p99 latency over five minutes.

## LM-03.1: errors with source map, release and role

1. In GlitchTip create an organisation `heach`, a project `web`, and an API token with
   `project:releases`, `project:read`, `event:read` and `org:read`. Keep the token and DSN out of
   files that are committed.
2. Build with a DSN, a release and source maps:
   `NEXT_PUBLIC_GLITCHTIP_DSN=<dsn> NEXT_PUBLIC_BUILD_VERSION=<release> SOURCE_MAPS=upload pnpm --filter "@heach/web..." build`
3. Upload the maps; the script deletes every `.map` file afterwards so none is served:
   `GLITCHTIP_URL=http://localhost:8000 GLITCHTIP_ORG=heach GLITCHTIP_PROJECT=web GLITCHTIP_AUTH_TOKEN=<token> node scripts/upload-source-maps.mjs <release>`
4. `pnpm --filter @heach/web exec next start -p 3100`, then
   `E2E_GLITCHTIP=1 E2E_BASE_URL=http://localhost:3100 GLITCHTIP_URL=http://localhost:8000 GLITCHTIP_AUTH_TOKEN=<token> NEXT_PUBLIC_BUILD_VERSION=<release> pnpm --filter @heach/web exec playwright test e2e/error-tracking.spec.ts --project=desktop`

The test throws a clearly labelled synthetic error inside `OfflineStatus` and checks that
GlitchTip shows the original `.tsx` file in the stack, the release and `role` tags, and no user.

The page CSP allows `connect-src` to the DSN's origin only when a DSN is built in.
