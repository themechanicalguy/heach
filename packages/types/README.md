# @heach/types

TypeScript types for the API contract, generated from the `apps/api` OpenAPI document with
[openapi-typescript](https://openapi-ts.dev). Front ends import these instead of writing their
own copies of API shapes.

```ts
import type { HealthStatus, paths } from '@heach/types';
```

| File                   | What it is                                        |
| ---------------------- | ------------------------------------------------- |
| `openapi.json`         | The API's OpenAPI document (generated, committed) |
| `src/generated/api.ts` | Types generated from it (committed, do not edit)  |
| `src/index.ts`         | Hand-written aliases for common schemas           |

## Regenerating

After changing an API route or DTO:

```sh
pnpm --filter @heach/types generate   # rebuilds the API, exports the document, regenerates types
pnpm --filter @heach/types check      # what CI runs: fails if the committed files are stale
```

Generation is a manual step, not part of `build`, so the API and this package never wait on
each other.
