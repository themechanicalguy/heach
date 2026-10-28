# Data model: Rate-limit bypass with fake bearer tokens

No stored data. No table, column, Redis key or browser storage is added or changed.

## Counters (in API process memory only)

The throttler keeps one counter per (route, throttler name, tracker). This feature changes only the
tracker:

| Request                                                        | Tracker               | Class    | Lifetime              |
| -------------------------------------------------------------- | --------------------- | -------- | --------------------- |
| Bearer token that resolves to a live session                   | `user:<userId>`       | Internal | Until the window ends |
| No header, malformed header, unknown, expired or revoked token | `ip:<client address>` | Internal | Until the window ends |
| Session store error during lookup                              | `ip:<client address>` | Internal | Until the window ends |

The throttler hashes the tracker into its storage key. Counters are never logged, returned,
persisted or shared between processes, and are lost on restart.

## Read, not written

| Key                             | Owner                                | Use here                                         |
| ------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `at:<sha-256 of token>` (Redis) | `AccessTokenStore` (Step 2, SE-07.1) | Read to decide whether a token is a live session |
