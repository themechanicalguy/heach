import { pino, type DestinationStream, type Level, type Logger } from 'pino';

/**
 * Keys that may hold personal or health data (LM-02). Matched at the top level and one level
 * deep. This is a safety net, not a licence: never pass Restricted data to the logger.
 */
const PII_KEYS = [
  'name',
  'mobile',
  'phone',
  'email',
  'address',
  'aadhaar',
  'dob',
  'otp',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
] as const;

export const DEFAULT_REDACT_PATHS: readonly string[] = PII_KEYS.flatMap((key) => [key, `*.${key}`]);

export interface LoggerOptions {
  /**
   * Service or module, written as `service` on every line. Not `name`: that key is always
   * redacted because it usually holds a person's name.
   */
  name: string;
  level?: Level;
  /** Extra paths to redact, added to DEFAULT_REDACT_PATHS. */
  redact?: readonly string[];
  /** Where to write; stdout by default. Tests pass an in-memory stream. */
  destination?: DestinationStream;
}

export type { Logger };

/** Structured JSON logger with personal-data redaction. Correlation IDs arrive in Step 2. */
export function createLogger({
  name,
  level = 'info',
  redact = [],
  destination,
}: LoggerOptions): Logger {
  const options = {
    level,
    base: { service: name },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
    redact: { paths: [...DEFAULT_REDACT_PATHS, ...redact], censor: '[REDACTED]' },
  };
  return destination ? pino(options, destination) : pino(options);
}
