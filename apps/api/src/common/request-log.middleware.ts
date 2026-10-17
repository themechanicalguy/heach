import type { NextFunction, Request, Response } from 'express';
import { appLogger } from './app-logger.js';

/** Receives each response status, for the LM-07.1 error-rate monitor. */
export type StatusSink = (status: number) => void;

/**
 * One line per request: method, route template, status and duration. Never the URL itself, the
 * body or headers, which can carry IDs or personal data.
 */
export function requestLog(sink: StatusSink) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    response.on('finish', () => {
      sink(response.statusCode);
      const route = (request.route as { path?: string } | undefined)?.path ?? 'unmatched';
      appLogger.info(
        {
          method: request.method,
          route,
          status: response.statusCode,
          durationMs: Number(process.hrtime.bigint() - started) / 1e6,
        },
        'request',
      );
    });
    next();
  };
}
