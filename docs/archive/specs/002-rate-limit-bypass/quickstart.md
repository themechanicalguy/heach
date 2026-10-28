# Quickstart: proving the rate-limit fix

Local services (an isolated project name avoids clashing with another checkout):

```sh
COMPOSE_PROJECT_NAME=heach-spec002 pnpm services:up
pnpm --filter @heach/api test -- user-throttler.guard        # SO-08.8, SO-08.11
pnpm --filter @heach/api test:e2e -- rate-limit security      # SO-08.1 to SO-08.10
```

Regression proof: with the current `user-throttler.guard.ts` from `main`, the SO-08.4, SO-08.6 and
SO-08.8 tests fail; with the fix they pass.

Through Caddy (CI deploy-bundle job, or by hand against a running bundle):

```sh
bash scripts/rate-limit-check.sh https://127.0.0.1    # expects at least one 429 from the API
```

It sends 150 requests to `/api/v1/auth/refresh`, each with a new random bearer token and a
random `X-Forwarded-For`; it uses up the caller's allowance for one window.
