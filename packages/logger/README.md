# @heach/logger

Structured JSON logger for the API and background jobs, built on [pino](https://getpino.io).

```ts
import { createLogger } from '@heach/logger';

const logger = createLogger({ name: 'api' });
logger.info({ port: 3001 }, 'API listening');
```

- One JSON object per line with `time` (ISO), `level`, `service` and `msg` (LM-01).
  The service goes in `service`, not `name`, because `name` is always redacted.
- Keys that commonly hold personal data (`name`, `mobile`, `address`, `aadhaar`, `otp`, tokens,
  and more; see `DEFAULT_REDACT_PATHS`) are replaced with `[REDACTED]`, at the top level and one
  level deep. Pass `redact` to add paths.
- Redaction is a safety net. **Never log personal or health data on purpose** (LM-02, PR-07).

Step 2 adds correlation IDs, OpenTelemetry trace context and the Nest logger adapter (LM-01 to LM-05).
