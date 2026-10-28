# Data model: Transactional session rotation and replay handling

No stored data is added or changed: no table, column, index, function, Redis key or browser
storage. What changes is which statements share a transaction and which rows they lock.

## Transaction and lock scope

| Operation                  | In one transaction (spec 003 `withTransaction`)                                                                                                                                                                                         | After commit                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Refresh (valid token)      | `SET LOCAL lock_timeout = '5s'`; `SELECT … FROM app.session s JOIN app.user_test u … WHERE refresh_token_hash = $1 FOR UPDATE`; `UPDATE app.session SET revoked_at`; `INSERT INTO app.session`; Redis `MULTI` issue of the access token | Nothing (on `COMMIT` failure: revoke that access token) |
| Refresh (replayed token)   | Same lock; `UPDATE app.session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`                                                                                                                                        | Redis revoke of every `user-at:<user>` token; 401       |
| Refresh (unknown, expired) | Lookup only; nothing locked when no row matches                                                                                                                                                                                         | 401                                                     |
| Sign out of all devices    | `SELECT 1 FROM app.user_test WHERE id = $1 FOR UPDATE`; revoke all session rows of the user                                                                                                                                             | Redis revoke of every access token of the user          |
| Sign out of this device    | Unchanged (single statement plus Redis delete)                                                                                                                                                                                          | —                                                       |
| Sign-in                    | Unchanged (insert plus issue; nothing to roll back if issue fails except an unused row that expires)                                                                                                                                    | —                                                       |

## Existing fields touched

| Field                               | Class        | Change                  |
| ----------------------------------- | ------------ | ----------------------- |
| `app.session.revoked_at`            | Internal     | Written inside the lock |
| `app.session.refresh_token_hash`    | Confidential | New row inside the lock |
| Redis `at:<hash>`, `user-at:<user>` | Confidential | Issued before commit    |
