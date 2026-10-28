# Contract: accounts and OTP API

Base path `/api/v1`. JSON bodies. Errors use the existing `error-response.ts` shape
`{ error: { code, message?, fields? } }`; messages are i18n keys, never personal data. Every
response to these routes has `Cache-Control: no-store`. The generated OpenAPI
(`pnpm --filter @heach/types generate`) is reviewed against this file.

## `POST /v1/auth/otp`

Public (reason: "Sign-in code request; throttled"). Throttled by number, device and address.

Request:

| Field    | Type                 | Rule                                                                               |
| -------- | -------------------- | ---------------------------------------------------------------------------------- |
| `mobile` | string               | 10 digits starting 6 to 9 after removing spaces, `-`, a leading `0`, `+91` or `91` |
| `locale` | `or` \| `en` \| `hi` | Language of the SMS and of a new account                                           |

202:

```json
{ "challengeId": "uuid", "resendAfter": 30, "expiresIn": 300 }
```

Errors: 400 `validation_failed` with `fields.mobile`; 429 `too_many_requests` with
`retryAfter` seconds (header `Retry-After` too); 503 `sms_unavailable`.

## `POST /v1/auth/otp/verify`

Public (reason: "Sign-in code check; throttled").

Request: `challengeId` (uuid), `code` (exactly 6 digits).

200, with the `heach_refresh` cookie as `test-login` sets it today:

```json
{ "accessToken": "…", "expiresIn": 900, "isNewAccount": true }
```

Errors: 400; 401 `code_invalid` with `attemptsLeft`; 410 `code_expired` (expired, used, replaced
or attempts used up: one code for all, so the client offers a new code); 429.

## `POST /v1/auth/reverify` and `POST /v1/auth/reverify/verify`

Roles `patient`. Request `purpose`, one of the purposes registered by consuming features
(`payout_details`, `account_deletion`; none is consumed in this feature except by the test-only
module). Responses as above, except verify answers 204 and issues no tokens.

A route protected by `@Reverified('payout_details')` answers 403
`{ error: { code: 'reverification_required', purpose: 'payout_details' } }` without a grant.

## `GET /v1/me`, `PATCH /v1/me`

Roles `patient`.

```json
{
  "id": "uuid",
  "mobileLast4": "4321",
  "preferredLanguage": "or",
  "signupIntent": "provide",
  "roles": ["patient"],
  "createdAt": "2026-10-28T10:00:00Z"
}
```

`PATCH` accepts only `preferredLanguage` and `signupIntent`; any other field is 400
`validation_failed`. `signupIntent` when already set is 409 `intent_already_given`.

## `POST /v1/test/sms-outbox`

Only where `TestLoginGate` lets a request through (SE-07.23); otherwise 404 before validation.
Request `{ "mobile": "…" }` in the body (never the URL, constitution IV). 200
`{ "code": "123456", "templateId": "otp.sign_in.or" }`.
