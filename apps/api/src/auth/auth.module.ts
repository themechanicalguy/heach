import { type DynamicModule, Module } from '@nestjs/common';
import type pg from 'pg';
import type { AppEnv } from '../config/env.schema.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { RoleAvailability } from '../flags/role-availability.js';
import { AccessTokenStore } from './access-token.store.js';
import { AuthController } from './auth.controller.js';
import { ReverificationStore } from './reverification.js';
import { ADMIN_REALM, type SessionRealm, USER_REALM } from './session-realm.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';
import { assertTestLoginAllowed } from './test-identity.adapter.js';
import { TestLoginGate } from './test-login.gate.js';

/** The admin realm's sessions (decision L-10); `SessionService` itself is the user realm's. */
export const ADMIN_SESSIONS = Symbol('ADMIN_SESSIONS');

const sessionsFor = (realm: SessionRealm) => ({
  inject: [PG_POOL, AccessTokenStore],
  useFactory: (pool: pg.Pool, tokens: AccessTokenStore) =>
    new SessionService(new SessionRepository(pool, realm), tokens, realm),
});

/**
 * The user realm's repository is a provider of its own, so tests can inject faults into it. Its
 * sessions in a role that is no longer offered end at refresh (ADR 0015).
 */
const userSessions = {
  inject: [SessionRepository, AccessTokenStore, RoleAvailability],
  useFactory: (repository: SessionRepository, tokens: AccessTokenStore, roles: RoleAvailability) =>
    new SessionService(repository, tokens, USER_REALM, (role) => roles.isOffered(role)),
};

/**
 * Sessions and tokens for both realms, and re-verification for sensitive actions. The test
 * identity adapter (test-login) refuses to start outside local, test and dev (SE-07.4) and, on
 * the dev host, answers only the loopback-only entry (SE-07.23).
 */
@Module({})
export class AuthModule {
  static register(appEnv: AppEnv): DynamicModule {
    assertTestLoginAllowed(appEnv);
    return {
      module: AuthModule,
      global: true,
      controllers: [AuthController],
      providers: [
        AccessTokenStore,
        {
          provide: SessionRepository,
          inject: [PG_POOL],
          useFactory: (pool: pg.Pool) => new SessionRepository(pool, USER_REALM),
        },
        { provide: SessionService, ...userSessions },
        { provide: ADMIN_SESSIONS, ...sessionsFor(ADMIN_REALM) },
        TestLoginGate,
        ReverificationStore,
      ],
      exports: [
        AccessTokenStore,
        SessionService,
        ADMIN_SESSIONS,
        TestLoginGate,
        ReverificationStore,
      ],
    };
  }
}
