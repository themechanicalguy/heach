import {
  pino,
  type Bindings,
  type ChildLoggerOptions,
  type DestinationStream,
  type Level,
  type Logger,
} from 'pino';
import { sanitizeLogValue } from './sanitize.js';

export { maskValue } from './mask.js';
export { isPersonalKey, sanitizeLogValue } from './sanitize.js';

export interface LoggerOptions {
  /**
   * Service or module, written as `service` on every line. Not `name`: that key is always
   * redacted because it usually holds a person's name.
   */
  name: string;
  level?: Level;
  /** Extra exact paths to redact, for keys the personal-word list cannot know. */
  redact?: readonly string[];
  /** Where to write; stdout by default. Tests pass an in-memory stream. */
  destination?: DestinationStream;
  /** Fields added to every line, for example the correlation and trace IDs (LM-01). */
  context?: () => Record<string, unknown>;
}

export type { Logger };

/**
 * A leading Error is logged as `{ err }`, with its masked message as the line's message when the
 * call gives none (LM-02.5). Every argument passes through the sanitizing pass (LM-02.7).
 */
function sanitizeArguments(args: unknown[]): unknown[] {
  const [first, ...rest] = args;
  if (first instanceof Error) {
    const message = typeof rest[0] === 'string' ? [] : [first.message];
    return [{ err: first }, ...message, ...rest].map(sanitizeLogValue);
  }
  return args.map(sanitizeLogValue);
}

type ChildFn = (bindings: Bindings, options?: ChildLoggerOptions) => Logger;

/** pino passes child bindings around formatters.log, so they are sanitized here (LM-02.7). */
function sanitizeChildBindings(logger: Logger): Logger {
  // pino types child() as generic over custom levels; these loggers define none.
  const child = logger.child.bind(logger) as unknown as ChildFn;
  const wrapped: ChildFn = (bindings, options) =>
    sanitizeChildBindings(child(sanitizeLogValue(bindings) as Bindings, options));
  return Object.assign(logger, { child: wrapped as unknown as Logger['child'] });
}

/**
 * Structured JSON logger. Personal keys are redacted and mobile numbers masked at every depth of
 * the merge object, context fields, interpolation arguments, child bindings and errors (LM-02).
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
    formatters: {
      level: (label: string) => ({ level: label }),
      log: (object: Record<string, unknown>) => sanitizeLogValue(object) as Record<string, unknown>,
    },
    // Errors are serialized by the pass already; pino's own serializer would turn them into Object.
    serializers: { err: (value: unknown) => value },
    ...(redact.length > 0 ? { redact: { paths: [...redact], censor: '[REDACTED]' } } : {}),
    ...(context ? { mixin: context } : {}),
    hooks: {
      logMethod(this: Logger, args: unknown[], method: (...a: unknown[]) => void) {
        method.apply(this, sanitizeArguments(args));
      },
    },
  };
  return sanitizeChildBindings(destination ? pino(options, destination) : pino(options));
}
