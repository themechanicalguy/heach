# Quickstart: proving transactional audit writes

Local services must be running (`COMPOSE_PROJECT_NAME=heach-spec003 pnpm services:up`, [local development](../../docs/local-development.md)).

```sh
pnpm --filter @heach/api test -- transaction notes.repository   # SE-05.9, SE-05.6 unit, SE-05.1
pnpm --filter @heach/api test:e2e -- audit-transaction          # SE-05.5 to SE-05.8, SE-05.10
pnpm --filter @heach/api test:e2e -- audit-chain sample-notes   # SE-05.2 to SE-05.4 still pass
```

Regression proof (once, before the fix): run the integration file against the current
`notes.repository.ts`; SE-05.5 and SE-05.7 must fail. Record the output in tasks.md "Evidence".
