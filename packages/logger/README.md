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
  level deep, and mobile numbers in top-level string values are masked. Deeper values are not
  masked yet (LM-02.1, [FU-27](../../docs/follow-up-register.md#closes-step-2)). Pass `redact` to
  add paths.
- Redaction is a safety net. **Never log personal or health data on purpose** (LM-02, PR-07).

Pass `context`, a function returning fields such as the correlation and trace IDs, to add them
to every line (LM-01).
