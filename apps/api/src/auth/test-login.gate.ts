import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { appLogger } from '../common/app-logger.js';
import { EnvVars } from '../config/env.schema.js';
import { TEST_LOGIN_KEY_HEADER, testLoginPermitted } from './test-identity.adapter.js';

/**
 * Runs before body validation, so a refused caller gets the same 404 as a route that does not
 * exist, whatever it sends (SE-07.23).
 */
@Injectable()
export class TestLoginGate implements CanActivate {
  constructor(private readonly env: EnvVars) {}

  canActivate(context: ExecutionContext): boolean {
    const presented = context.switchToHttp().getRequest<Request>().header(TEST_LOGIN_KEY_HEADER);
    if (!testLoginPermitted(this.env.APP_ENV, this.env.TEST_LOGIN_KEY, presented)) {
      appLogger.warn({ event: 'test_login_refused' }, 'Test sign-in refused');
      throw new NotFoundException();
    }
    return true;
  }
}
