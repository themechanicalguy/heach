import type { components } from './generated/api.js';

/** Generated from the apps/api OpenAPI document. Regenerate with `pnpm --filter @heach/types generate`. */
export type { components, paths } from './generated/api.js';

export type HealthStatus = components['schemas']['HealthStatusDto'];
export type Readiness = components['schemas']['ReadinessDto'];
