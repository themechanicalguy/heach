# Quickstart: proving bounded, audited re-encryption

Local services must be running (`COMPOSE_PROJECT_NAME=heach-spec005 pnpm services:up`,
[local development](../../../local-development.md)). Spec 003 must already be implemented.

```sh
pnpm --filter @heach/api test -- reencrypt audit.service      # EN-05.4 to EN-05.6 unit
pnpm --filter @heach/api test:e2e -- reencrypt crypto         # EN-05.3 to EN-05.9
```

Regression proof (once, before the fix): run `reencrypt.spec.ts` against current `main`; the
EN-05.4 test must hit its loop bound. Record it in tasks.md "Evidence".

Manual (operator, dev host): follow [the key-rotation runbook](../../../runbooks/key-rotation.md);
record the end line and exit code in its record table.
