# @heach/logger

Structured JSON logger for the API and background jobs, built on [pino](https://getpino.io).

```ts
import { createLogger } from '@heach/logger';

const logger = createLogger({ name: 'api', context: () => ({ correlationId }) });
logger.info({ port: 3001 }, 'API listening');
```

- One JSON object per line with `time` (ISO), `level`, `service` and `msg` (LM-01). The service
  goes in `service`, not `name`, because `name` is always redacted. `context` adds fields such as
  the correlation and trace IDs to every line.
- Every value passes through `sanitizeLogValue` (LM-02), at every depth of the logged object,
  `context` fields, interpolation arguments, child bindings and errors:
  - a key holding a personal word (`name`, `mobile`, `phone`, `email`, `address`, `aadhaar`, `dob`,
    `otp`, `password`, `token`, `authorization`, `cookie`, `body`, `note`, `notes`, `diagnosis`,
    `prescription`), matched by word in any case or separator (`phoneNumber`, `patient_name`,
    `X-Auth-Token`), is written as `[REDACTED]`;
  - Indian mobile numbers in strings and numbers become `[MOBILE]`; trace IDs, span IDs and UUIDs
    are kept;
  - errors keep their type, with message, stack and fields masked;
  - past depth 8, cycles, binary data and unreadable fields become `[DEPTH]`, `[CIRCULAR]`,
    `[BINARY]` and `[UNREADABLE]`. The caller's object is never changed.
- Data used as keys (table names, for example) can hold a personal word and be redacted: log such
  maps as `[key, value]` pairs instead. `redact` adds exact pino paths for anything else.
- Masking is a safety net. **Never log personal or health data on purpose** (LM-02, PR-07).
