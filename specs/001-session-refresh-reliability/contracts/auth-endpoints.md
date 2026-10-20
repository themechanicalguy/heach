# Contract: auth endpoints (unchanged)

This feature changes no endpoint. It relies on the Step 2 behaviour below, which
`apps/api/test/auth.int-spec.ts` pins; the generated `packages/types/openapi.json` must not change.

## `POST /api/v1/auth/refresh`

- **Auth**: `@Public`; the `heach_refresh` cookie (`Secure`, `HttpOnly`, `SameSite=Strict`, path
  `/api/v1/auth`) is the credential.
- **200**: `{ "accessToken": string, "expiresIn": 900 }`, a new cookie, `Cache-Control: no-store`.
  The presented token is revoked (single use).
- **401** (cookie cleared): no cookie, unknown or expired token, or a token already used. A token
  already used, including one that loses a concurrent race, gets no tokens and revokes every
  session and access token of the user that exists at that moment (SE-07.2, SE-07.13). A concurrent
  winner's new session may be created after that revocation (backlog item 3).

## `POST /api/v1/auth/logout`

- **Auth**: bearer access token, every role.
- **Body**: `{ "allDevices": boolean }`.
- **204** (cookie cleared): `allDevices: false` revokes the session the access token belongs to and
  that access token; `true` revokes every session of the user (SE-07.3).
- **401** without a valid access token; **400** on an invalid body.
