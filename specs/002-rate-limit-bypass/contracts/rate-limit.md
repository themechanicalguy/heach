# Contract: API rate limit

Applies to every API route except `GET /healthz` and `GET /readyz`. No endpoint, DTO or OpenAPI
change.

## Counting rule

1. If the `Authorization` header is `Bearer <token>` with `<token>` matching `[\w-]{20,}`, and
   `AccessTokenStore.resolve(<token>)` returns a principal, count against `user:<principal.userId>`.
2. Otherwise, including when the lookup throws, count against `ip:<req.ip>`.

`req.ip` is the last entry of `X-Forwarded-For` (Express `trust proxy` = 1). The API is reachable
only through Caddy, which sets that entry to the real peer address.

## Configuration

| Variable                    | Type        | Default | Meaning                                                          |
| --------------------------- | ----------- | ------- | ---------------------------------------------------------------- |
| `RATE_LIMIT_PER_MINUTE`     | integer ≥ 1 | 120     | Requests allowed per tracker per window (Step 2, unchanged name) |
| `RATE_LIMIT_WINDOW_SECONDS` | integer ≥ 1 | 60      | Window length (new)                                              |

The RUM route (`POST /v1/rum`) keeps its own limit of 60 per 60 seconds.

## Responses

Within the limit: unchanged (no rate-limit headers are promised).

Over the limit:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: <whole seconds until the counter resets, 1 to the window length>
Content-Type: application/json

{ "statusCode": 429, "error": "ThrottlerException", "message": "ThrottlerException: Too Many Requests",
  "path": "<request path>", "timestamp": "<ISO time>" }
```

The body is the standard `ErrorResponse`. It never contains the token, the client address, the
user ID or the tracker.

## Log

The existing request log line only: `{ method, route, status: 429, durationMs }`.
