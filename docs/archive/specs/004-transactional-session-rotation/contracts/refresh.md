# Contract: `POST /v1/auth/refresh` responses and the refresh cookie

Request, response body and OpenAPI are unchanged (Step 2, `AccessTokenDto`). This contract fixes
what each outcome does to the `heach_refresh` cookie (path `/api/v1/auth`).

| Outcome                                                       | Status       | Body                       | `Set-Cookie: heach_refresh`           | Session state afterwards                                  | Criterion                    |
| ------------------------------------------------------------- | ------------ | -------------------------- | ------------------------------------- | --------------------------------------------------------- | ---------------------------- |
| Valid, unused token; rotation committed                       | 200          | `accessToken`, `expiresIn` | New token, Secure, HttpOnly, Strict   | Old used, new active                                      | SE-07.1                      |
| Missing, unknown or expired token                             | 401          | Generic error              | Cleared                               | Unchanged                                                 | SE-07.16                     |
| Token already used (replay), sequential or concurrent         | 401          | Generic error              | Cleared                               | Every session and access token of the user revoked        | SE-07.18, SE-07.19           |
| Database, Redis or pool failure, lock timeout, commit failure | 500 (or 503) | Generic error              | **Not sent**                          | Unchanged (old session still usable)                      | SE-07.14, SE-07.15, SE-07.16 |
| Replay detected, database revoked, Redis revoke failed        | 500          | Generic error              | Not sent (the cookie is already dead) | Every session revoked; access tokens expire within 15 min | Edge case                    |
| Rate limited or invalid request (before the controller)       | 429 / 400    | Generic error              | Not sent (unchanged)                  | Unchanged                                                 | SO-08.1                      |

The web client (spec 001) already treats only 401 as "session over" (SE-07.8, SE-07.9), so no
client change follows.
