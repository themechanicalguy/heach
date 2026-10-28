# Data model: OTP sign-up and sign-in

Classes from [spec.md](spec.md#key-entities-and-data-classification); every column carries a
`class=` comment (DC-01.1). Migration `apps/api/migrations/0003_user_accounts.sql`.

## `app.user_account`

| Column                          | Type                                                 | Class        | Notes                                             |
| ------------------------------- | ---------------------------------------------------- | ------------ | ------------------------------------------------- |
| `id`                            | `uuid` primary key                                   | Internal     |                                                   |
| `mobile`                        | `app.encrypted_field` not null                       | Confidential | Field-encrypted under the identity domain (D3-2)  |
| `mobile_bidx`                   | `text` not null unique                               | Internal     | `BlindIndexer.index('identity', '+91XXXXXXXXXX')` |
| `mobile_last4`                  | `char(4)` not null                                   | Internal     | For the masked display only                       |
| `preferred_language`            | `text` not null check in (`or`, `en`, `hi`)          | Internal     |                                                   |
| `signup_intent`                 | `text` null check in (`care`, `provide`)             | Internal     | Set once                                          |
| `status`                        | `text` not null default `active` check in (`active`) | Internal     | Widened by 3.10, 3.12                             |
| `created_at`, `last_sign_in_at` | `timestamptz`                                        | Internal     |                                                   |

`check-classification.ts` requires `app.encrypted_field` only for Restricted columns; `mobile` is
Confidential and is encrypted by decision D3-2. A test in `crypto.int-spec.ts` (EN-09.3) proves
the stored value is ciphertext, since the class check will not.

## `app.role_assignment`

| Column       | Type                                                   | Class    | Notes                            |
| ------------ | ------------------------------------------------------ | -------- | -------------------------------- |
| `user_id`    | `uuid` references `app.user_account` on delete cascade | Internal |                                  |
| `role`       | `text` not null check in (`patient`)                   | Internal | 3.2 widens the check             |
| `granted_by` | `uuid` null                                            | Internal | Null means the system at sign-up |
| `granted_at` | `timestamptz` not null default now()                   | Internal |                                  |

Primary key `(user_id, role)`.

## `app.otp_challenge`

| Column                     | Type                          | Class        | Notes                                             |
| -------------------------- | ----------------------------- | ------------ | ------------------------------------------------- |
| `id`                       | `uuid` primary key            | Internal     | Returned to the client as `challengeId`           |
| `mobile_bidx`              | `text` not null               | Internal     | Never the number                                  |
| `purpose`                  | `text` not null               | Internal     | `sign_in` or `reverify:<purpose>`                 |
| `session_id`               | `uuid` null                   | Internal     | Required for `reverify:*`                         |
| `code_hash`                | `text` not null               | Confidential | HMAC (plan, Encryption and keys)                  |
| `locale`                   | `text` not null               | Internal     | Language of the SMS and of a new account          |
| `attempts`                 | `smallint` not null default 0 | Internal     |                                                   |
| `created_at`, `expires_at` | `timestamptz` not null        | Internal     |                                                   |
| `ended_at`                 | `timestamptz` null            | Internal     | Success, attempts used up, resend or expiry sweep |
| `end_reason`               | `text` null                   | Internal     | `verified`, `attempts`, `replaced`, `expired`     |

Index `(mobile_bidx, purpose) where ended_at is null`, unique: one live challenge per number and
purpose. A daily job deletes rows ended more than 24 hours ago (existing jobs pattern).

## `app.session` (changed)

`user_id` references `app.user_account (id)` instead of `app.user_test (id)`. Existing rows are
revoked by the migration.

## Redis keys

| Key                                | TTL              | Holds                            |
| ---------------------------------- | ---------------- | -------------------------------- |
| `otp:n:{bidx}:h`, `otp:n:{bidx}:d` | 1 hour, 24 hours | Requests per number              |
| `otp:d:{device}:h`                 | 1 hour           | Requests per device cookie       |
| `otp:a:{address}:h`                | 1 hour           | Requests per network address     |
| `otp:cool:{bidx}:{purpose}`        | 30 seconds       | Resend cooldown                  |
| `reverify:{sessionId}:{purpose}`   | 5 minutes        | Single-use re-verification grant |

## State of a challenge

`live` → `ended(verified)` on the right code; `live` → `ended(attempts)` on the fifth wrong code;
`live` → `ended(replaced)` on a resend; `live` past `expires_at` behaves as ended and is swept to
`ended(expired)`.
