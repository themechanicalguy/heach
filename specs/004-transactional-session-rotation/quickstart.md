# Quickstart: proving transactional session rotation

Local services must be running (`COMPOSE_PROJECT_NAME=heach-spec004 pnpm services:up`,
[local development](../../docs/local-development.md)). Spec 003 must already be implemented.

```sh
pnpm --filter @heach/api test -- session.service auth.controller      # SE-07.14 to SE-07.16 unit
pnpm --filter @heach/api test:e2e -- session-rotation                 # SE-07.14 to SE-07.20
pnpm --filter @heach/api test:e2e -- auth                             # SE-07.1 to SE-07.13 still pass
```

Regression proof (once, before the fix): run `session-rotation.int-spec.ts` against current
`main`; SE-07.14, SE-07.16 and SE-07.18 must fail. Record the output in tasks.md "Evidence".
