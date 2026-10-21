# Data model: Session-refresh reliability

No stored data is added or changed: no table, column, migration, Redis key or browser storage.
The server's `app.session` table (Step 2 spec, Data section) is unchanged.

## Client session state (memory only, one per tab)

| Item              | Type                                  | Class                   | Lifetime                                                  |
| ----------------- | ------------------------------------- | ----------------------- | --------------------------------------------------------- |
| Access token      | string or none                        | Confidential            | Memory; ≤ 15 min (SE-07.1); dropped when the session ends |
| Epoch             | integer                               | Internal (not personal) | Memory; increments on sign-in and on session end          |
| In-flight refresh | promise or none                       | Internal                | Memory; while one refresh is running                      |
| Status (provider) | `checking`, `signed-in`, `signed-out` | Internal                | React state                                               |

## Transitions

| From        | Event                                         | To           | Effect                                                                      |
| ----------- | --------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| `checking`  | restore refresh `ok`                          | `signed-in`  | token set                                                                   |
| `checking`  | restore refresh `rejected` or `failed`        | `signed-out` | nothing cleared on `failed` (cookie kept)                                   |
| `signed-in` | call gets 401, refresh `ok`                   | `signed-in`  | token replaced; call retried once                                           |
| `signed-in` | refresh `rejected`                            | `signed-out` | token dropped, epoch +1, broadcast `signed-out`                             |
| `signed-in` | refresh `failed`                              | `signed-in`  | call fails with a retryable error                                           |
| `signed-in` | user signs out                                | `signed-out` | wait for in-flight refresh, logout call, token dropped, epoch +1, broadcast |
| any         | `signed-out` broadcast from another tab       | `signed-out` | token dropped, epoch +1 (no re-broadcast)                                   |
| any         | sign-in                                       | `signed-in`  | epoch +1, token set                                                         |
| any         | result of a refresh started in an older epoch | unchanged    | result ignored                                                              |

## Cross-tab messages

Channel `heach-session`, one message type: `{ "type": "signed-out" }`. No token, user ID or other
data. Unknown messages are ignored.
