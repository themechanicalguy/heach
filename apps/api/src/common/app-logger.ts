import { createLogger, type Logger } from '@heach/logger';
import type { LoggerService } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { currentContext } from './request-context.js';

/** Correlation ID, role and trace ID on every line (LM-01). Never the user's identity details. */
export function logContext(): Record<string, unknown> {
  const context = currentContext();
  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  return {
    ...(context ? { correlationId: context.correlationId } : {}),
    ...(context?.principal ? { role: context.principal.role } : {}),
    ...(traceId ? { traceId } : {}),
  };
}

export const appLogger: Logger = createLogger({ name: 'api', context: logContext });

/** Routes Nest's own logging through @heach/logger, so it is masked and structured too. */
export class NestAppLogger implements LoggerService {
  log(message: unknown, scope?: string): void {
    appLogger.info({ scope }, String(message));
  }

  error(message: unknown, _trace?: string, scope?: string): void {
    appLogger.error({ scope }, String(message));
  }

  warn(message: unknown, scope?: string): void {
    appLogger.warn({ scope }, String(message));
  }

  debug(message: unknown, scope?: string): void {
    appLogger.debug({ scope }, String(message));
  }
}
