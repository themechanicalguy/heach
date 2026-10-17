import type { components } from './generated/api.js';

/** Generated from the apps/api OpenAPI document. Regenerate with `pnpm --filter @heach/types generate`. */
export type { components, paths } from './generated/api.js';

export type HealthStatus = components['schemas']['HealthStatusDto'];
export type Readiness = components['schemas']['ReadinessDto'];
export type AccessToken = components['schemas']['AccessTokenDto'];
export type TestLogin = components['schemas']['TestLoginDto'];
export type Logout = components['schemas']['LogoutDto'];
export type WebVital = components['schemas']['WebVitalDto'];
export type CreateNote = components['schemas']['CreateNoteDto'];
export type CreatedNote = components['schemas']['CreatedNoteDto'];
export type Note = components['schemas']['NoteDto'];
