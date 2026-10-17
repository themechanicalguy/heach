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
  // Restricted health fields (LM-02.1); the sample note body is one.
  'body',
  'note',
  'notes',
  'diagnosis',
  'prescription',
] as const;

/** Indian mobile numbers, with or without +91, wherever they appear in a string value. */
const MOBILE_PATTERN = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g;

/** Masks mobile numbers inside strings that redaction by key cannot see (LM-02.1). */
export function maskValue(value: string): string {
  return value.replace(MOBILE_PATTERN, '[MOBILE]');
}

function maskStrings(object: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [
      key,
      typeof value === 'string' ? maskValue(value) : value,
    ]),
  );
}

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
  /** Fields added to every line, for example the correlation and trace IDs (LM-01). */
  context?: () => Record<string, unknown>;
}

export type { Logger };

/**
 * Structured JSON logger with personal-data redaction by key, mobile-number masking in string
 * values and messages, and per-request context such as the correlation ID.
 */
export function createLogger({
  name,
  level = 'info',
  redact = [],
  destination,
  context,
}: LoggerOptions): Logger {
  const options = {
    level,
    base: { service: name },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }), log: maskStrings },
    redact: { paths: [...DEFAULT_REDACT_PATHS, ...redact], censor: '[REDACTED]' },
    ...(context ? { mixin: context } : {}),
    hooks: {
      logMethod(this: Logger, args: Parameters<Logger['info']>, method: (...a: unknown[]) => void) {
        method.apply(
          this,
          args.map((arg) => (typeof arg === 'string' ? maskValue(arg) : arg)),
        );
      },
    },
  };
  return destination ? pino(options, destination) : pino(options);
}
