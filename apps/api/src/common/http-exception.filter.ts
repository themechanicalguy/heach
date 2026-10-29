import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorResponse } from './error-response.js';

/**
 * Maps every thrown error to ErrorResponse. Unexpected errors return a generic 500 so no
 * internal detail, stack or data reaches the client; only the error type is logged here.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const body = this.toBody(exception, request.path);
    const response = http.getResponse<Response>();
    // A throttled answer says when to try again (SE-08), as the rate-limit guard does.
    const retryAfter = (exception as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
    if (typeof retryAfter === 'number') response.setHeader('Retry-After', String(retryAfter));
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, path: string): ErrorResponse {
    const base = { path, timestamp: new Date().toISOString() };
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return { ...base, statusCode, ...readHttpMessage(exception) };
    }
    const errorType = exception instanceof Error ? exception.name : typeof exception;
    this.logger.error(`Unhandled ${errorType} on ${path}`);
    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }
}

function readHttpMessage(
  exception: HttpException,
): Pick<ErrorResponse, 'error' | 'message' | 'code'> {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return { error: exception.name, message: response };
  }
  const { error, message, code } = response as Partial<ErrorResponse>;
  return {
    error: error ?? exception.name,
    message: message ?? exception.message,
    ...(code ? { code } : {}),
  };
}
