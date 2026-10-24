import { type DynamicModule, Module } from '@nestjs/common';
import type { AppEnv } from '../config/env.schema.js';
import { AccessTokenStore } from './access-token.store.js';
import { AuthController } from './auth.controller.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';
import { assertTestLoginAllowed } from './test-identity.adapter.js';
import { TestLoginGate } from './test-login.gate.js';

/**
 * Sessions and tokens. The test identity adapter (test-login) refuses to start outside dev and
 * test (SE-07.4) and, on the dev host, answers only the loopback-only entry (SE-07.23); Step 3
 * replaces it with OTP login.
 */
@Module({})
export class AuthModule {
  static register(appEnv: AppEnv): DynamicModule {
    assertTestLoginAllowed(appEnv);
    return {
      module: AuthModule,
      global: true,
      controllers: [AuthController],
      providers: [AccessTokenStore, SessionRepository, SessionService, TestLoginGate],
      exports: [AccessTokenStore, SessionService],
    };
  }
}
