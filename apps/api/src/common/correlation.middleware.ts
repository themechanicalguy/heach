import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithContext } from './request-context.js';

export const CORRELATION_HEADER = 'x-correlation-id';
const VALID_ID = /^[\w-]{8,64}$/;

/** Accepts a well-formed incoming correlation ID or creates one, and echoes it (LM-01). */
export function correlationMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header(CORRELATION_HEADER);
  const correlationId = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader(CORRELATION_HEADER, correlationId);
  runWithContext({ correlationId }, next);
}
