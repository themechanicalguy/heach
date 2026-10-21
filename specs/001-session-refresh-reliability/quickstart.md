# Quickstart: proving session-refresh reliability

Prerequisites: [local development](../../docs/local-development.md) set up (`pnpm install`,
`pnpm services:up` for the API tests).

| What                                                                | Command                                                                                                                                      | Expect                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Web unit tests (SE-07.5 to SE-07.11)                                | `pnpm --filter @heach/web test`                                                                                                              | All `SE-07.*` tests pass             |
| API integration tests (SE-07.10, SE-07.13, SE-07.1 to .3 unchanged) | `pnpm --filter @heach/api test:e2e`                                                                                                          | `Sessions (SE-07)` suite passes      |
| Full-stack E2E (SE-07.5, .7, .12)                                   | `pnpm dev:up`, then `E2E_API=1 E2E_BASE_URL=http://localhost:3000 pnpm --filter @heach/web exec playwright test e2e/session-refresh.spec.ts` | Passes on mobile, tablet and desktop |
| SC-001 repetition                                                   | the E2E command above with `--repeat-each 50 --project desktop`                                                                              | 50 of 50 pass                        |
| Contract unchanged                                                  | `pnpm --filter @heach/types check`                                                                                                           | No OpenAPI diff                      |
| Repository checks                                                   | `pnpm check`, `pnpm test:scripts`, `node scripts/check-specs.mjs`                                                                            | Pass                                 |

Manual check in a browser (optional): sign in with a test patient, open a second tab, sign out in
one; the other shows the signed-out state within 2 seconds.
