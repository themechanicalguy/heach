import type { FieldEncryptor } from '@heach/crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_SESSIONS } from '../auth/auth.module.js';
import { ReverificationStore } from '../auth/reverification.js';
import type { IssuedTokens, SessionService } from '../auth/session.service.js';
import { hashToken, newToken } from '../auth/token-hash.js';
import { appLogger } from '../common/app-logger.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import { type AdminAccount, AdminAccountRepository } from './admin-account.repository.js';
import { DUMMY_HASH_PROMISE, verifyPassword } from './password.js';
import { matchTotp, newTotpSecret, otpauthUri } from './totp.js';

/** Between the password and the TOTP code: 5 minutes and 5 codes at most (decision L-9). */
const MFA_TICKET = { ttlSeconds: 5 * 60, maxAttempts: 5 } as const;
const ENTITY = 'admin_account';

export interface PasswordAccepted {
  mfaTicket: string;
  /** Present only until the first accepted code: the secret to add to an authenticator app. */
  enrolment?: { secret: string; uri: string };
}

const fail = (code: string) =>
  new UnauthorizedException({ error: 'Unauthorized', message: code, code });

/**
 * Admin sign-in (AD-01, SE-04): email and password, then a TOTP code, always. One answer for an
 * unknown email, a wrong password, a disabled or a locked account, after the same scrypt work.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly admins: AdminAccountRepository,
    @Inject(ADMIN_SESSIONS) private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly reverifications: ReverificationStore,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async checkPassword(email: string, password: string): Promise<PasswordAccepted> {
    const admin = await this.admins.findByEmail(email.trim().toLowerCase());
    const matches = await verifyPassword(
      password,
      admin?.passwordHash ?? (await DUMMY_HASH_PROMISE),
    );
    if (!admin) throw fail('invalid_credentials');
    const locked = admin.lockedUntil !== null && admin.lockedUntil.getTime() > Date.now();
    if (!matches || locked || !admin.active) {
      await this.refuse(admin, matches);
      throw fail('invalid_credentials');
    }
    await this.admins.resetFailures(admin.id);
    return { mfaTicket: await this.openTicket(admin.id), ...(await this.enrolmentFor(admin)) };
  }

  /** The second factor; a code's time step works once (decision L-9). */
  async checkCode(mfaTicket: string, code: string): Promise<IssuedTokens> {
    const key = ticketKey(mfaTicket);
    const adminId = await this.redis.hget(key, 'adminId');
    const admin = adminId ? await this.admins.findById(adminId) : undefined;
    if (!admin?.active || !admin.totpSecret) throw fail('mfa_expired');
    const step = matchTotp(
      await this.encryptor.decrypt(admin.totpSecret),
      code,
      Date.now(),
      admin.totpLastStep,
    );
    if (step === undefined || !(await this.admins.acceptStep(admin.id, step, true))) {
      await this.countWrongCode(key);
      throw fail('mfa_incorrect');
    }
    await this.redis.del(key);
    if (!admin.totpEnrolled) await this.record('admin.mfa.enrolled', admin.id);
    await this.record('admin.sign_in', admin.id);
    return this.sessions.signIn(admin.id, admin.role);
  }

  /** A fresh TOTP code unlocks sensitive admin actions for five minutes (decision L-11). */
  async reverify(principal: Principal, code: string): Promise<void> {
    const admin = await this.admins.findById(principal.userId);
    if (!admin?.active || !admin.totpSecret) throw fail('mfa_incorrect');
    const step = matchTotp(
      await this.encryptor.decrypt(admin.totpSecret),
      code,
      Date.now(),
      admin.totpLastStep,
    );
    if (step === undefined || !(await this.admins.acceptStep(admin.id, step, false))) {
      await this.record('admin.reverify.failed', admin.id);
      throw fail('mfa_incorrect');
    }
    await this.reverifications.mark(principal.sessionId);
    await this.record('admin.reverified', admin.id);
  }

  async profile(principal: Principal): Promise<Pick<AdminAccount, 'email' | 'role'>> {
    const admin = await this.admins.findById(principal.userId);
    if (!admin) throw fail('invalid_credentials');
    return { email: admin.email, role: admin.role };
  }

  private async refuse(admin: AdminAccount, passwordMatched: boolean): Promise<void> {
    if (!passwordMatched && (await this.admins.recordFailure(admin.id))) {
      appLogger.warn({ event: 'admin_locked' }, 'Admin account locked after failed passwords');
      await this.record('admin.locked', admin.id);
    }
    await this.record('admin.sign_in.failed', admin.id);
  }

  private async openTicket(adminId: string): Promise<string> {
    const { token, hash } = newToken();
    await this.redis
      .multi()
      .hset(`admin-mfa:${hash}`, { adminId, attempts: 0 })
      .expire(`admin-mfa:${hash}`, MFA_TICKET.ttlSeconds)
      .exec();
    return token;
  }

  private async countWrongCode(key: string): Promise<void> {
    if ((await this.redis.hincrby(key, 'attempts', 1)) >= MFA_TICKET.maxAttempts) {
      await this.redis.del(key);
    }
  }

  /** A new secret at each password sign-in until enrolment is confirmed by a first code. */
  private async enrolmentFor(admin: AdminAccount): Promise<Pick<PasswordAccepted, 'enrolment'>> {
    if (admin.totpEnrolled) return {};
    const secret = newTotpSecret();
    await this.admins.setPendingSecret(admin.id, await this.encryptor.encrypt(secret, 'identity'));
    return { enrolment: { secret, uri: otpauthUri(secret, admin.email) } };
  }

  private async record(action: string, adminId: string): Promise<void> {
    await this.audit.record({ action, entity: ENTITY, entityId: adminId });
  }
}

const ticketKey = (ticket: string) => `admin-mfa:${hashToken(ticket)}`;
