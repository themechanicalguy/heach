import type { FieldEncryptor } from '@heach/crypto';
import type { Locale } from '@heach/i18n';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { IssuedTokens } from '../auth/session.service.js';
import { SessionService } from '../auth/session.service.js';
import type { GrantedUserRole, Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { maskMobile } from '../otp/mobile-number.js';
import {
  type IssuedChallenge,
  type OtpOrigin,
  OtpService,
  type VerifiedMobile,
} from '../otp/otp.service.js';
import {
  type AccountRecord,
  AccountRepository,
  type ApplicationStatus,
  type SetupPatch,
} from './account.repository.js';
import type { AddRoleDto, MeDto } from './accounts.dto.js';
import { type ConsentGiven, consentsDue, coversCurrentVersions } from './consent-versions.js';
import {
  initialRole,
  missingFields,
  NEW_PROVIDER_STATUS,
  nextSetupStep,
  type RegistrableRole,
  sideOf,
} from './setup-rules.js';

const ENTITY = 'account';

/** A stable reason code the web app translates; never personal data (generic errors). */
function reason(Exception: new (body: object) => Error, code: string): Error {
  return new Exception({ error: Exception.name.replace('Exception', ''), message: code, code });
}

/**
 * Accounts of patients and providers: sign-in after a proven OTP, setup with save and resume,
 * versioned consent, role switching and adding a role (AC-01 to AC-05, PR-01; decisions L-1 to
 * L-5). Every role is granted here, from rules on the server, never from the request alone.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  /** New and returning users alike; a suspended account learns so only after a proven OTP. */
  async signIn(verified: VerifiedMobile, locale: Locale): Promise<IssuedTokens> {
    const { id, created } = await this.accounts.findOrCreate(verified, locale);
    const account = await this.load(id);
    if (account.status !== 'active') {
      await this.record('account.sign_in.refused', id);
      throw reason(ForbiddenException, 'account_suspended');
    }
    await this.accounts.recordSignIn(id);
    await this.record(created ? 'account.created' : 'account.sign_in', id);
    return this.sessions.signIn(id, initialRole(account.roles, account.lastActiveRole));
  }

  /** Test sign-in (dev and test only): synthetic accounts, never one created by OTP (L-1). */
  async signInSynthetic(id: string): Promise<IssuedTokens | undefined> {
    const account = await this.accounts.find(id);
    if (!account?.synthetic || account.status !== 'active') return undefined;
    return this.sessions.signIn(id, initialRole(account.roles, account.lastActiveRole));
  }

  async view(principal: Principal): Promise<MeDto> {
    const account = await this.load(principal.userId);
    const complete = account.setupCompletedAt !== null;
    return {
      locale: account.locale,
      mobile: account.mobile ? maskMobile(await this.encryptor.decrypt(account.mobile)) : null,
      activeRole: principal.role,
      roles: account.roles,
      setup: {
        complete,
        nextStep: complete ? null : nextSetupStep(account.draft),
        draft: { ...account.draft, languages: [...account.draft.languages] },
      },
      consentsDue: consentsDue(account.consents),
    };
  }

  async saveSetup(principal: Principal, patch: SetupPatch): Promise<void> {
    if (!(await this.accounts.saveDraft(principal.userId, patch))) {
      throw reason(ConflictException, 'setup_complete');
    }
  }

  /**
   * Grants the role setup asked for, records the consents and finishes setup, in one transaction
   * under the account's lock: a repeated or concurrent submission grants nothing twice. Returns an
   * access token for the granted role.
   */
  async completeSetup(
    principal: Principal,
    accessToken: string,
    consents: readonly ConsentGiven[],
  ): Promise<string> {
    if (!coversCurrentVersions(consents)) throw reason(ConflictException, 'consent_outdated');
    const role = await this.accounts.transaction(async (client) => {
      const account = await this.accounts.lockForSetup(client, principal.userId);
      if (!account || account.setupCompletedAt) throw reason(ConflictException, 'setup_complete');
      const requested = account.draft.role;
      if (!requested || missingFields(account.draft).length > 0) {
        throw reason(BadRequestException, 'setup_incomplete');
      }
      await this.grant(client, account.id, requested);
      await this.accounts.recordConsents(client, account.id, consents, account.locale);
      await this.accounts.markSetupComplete(client, account.id);
      await this.audit.record(
        { action: 'account.setup.completed', entity: ENTITY, entityId: account.id },
        client,
      );
      return requested;
    });
    return this.switchRole(principal, accessToken, role);
  }

  /** A newer text version, accepted by a returning user. */
  async acceptConsents(principal: Principal, consents: readonly ConsentGiven[]): Promise<void> {
    if (!coversCurrentVersions(consents)) throw reason(ConflictException, 'consent_outdated');
    const account = await this.load(principal.userId);
    await this.accounts.transaction(async (client) => {
      await this.accounts.recordConsents(client, account.id, consents, account.locale);
      await this.audit.record(
        { action: 'account.consent.given', entity: ENTITY, entityId: account.id },
        client,
      );
    });
  }

  async setLocale(principal: Principal, locale: Locale): Promise<void> {
    await this.accounts.setLocale(principal.userId, locale);
  }

  /** Only to a role the account holds now, checked on the server (decision L-3). */
  async switchRole(
    principal: Principal,
    accessToken: string,
    role: GrantedUserRole,
  ): Promise<string> {
    const roles = await this.accounts.roles(principal.userId);
    if (!roles.some((grant) => grant.role === role)) {
      await this.record('account.role.switch.denied', principal.userId);
      throw reason(ForbiddenException, 'role_not_granted');
    }
    const token = await this.sessions.switchRole(principal, accessToken, role);
    await this.accounts.setLastActiveRole(principal.userId, role);
    await this.record('account.role.switched', principal.userId);
    return token;
  }

  /**
   * Adds the side the account does not have yet (care or provider). The route requires a fresh
   * OTP; the role is checked against the same rules as setup.
   */
  async addRole(principal: Principal, request: AddRoleDto): Promise<void> {
    await this.accounts.transaction(async (client) => {
      const account = await this.accounts.lockForSetup(client, principal.userId);
      if (!account?.setupCompletedAt) throw reason(ConflictException, 'setup_incomplete');
      const side = sideOf(request.role);
      if (account.roles.some((grant) => grant.side === side)) {
        throw reason(ConflictException, 'side_taken');
      }
      const missing = missingFields({
        ...account.draft,
        role: request.role,
        languages: request.languages ?? account.draft.languages,
        organisationName: request.organisationName ?? account.draft.organisationName,
      });
      if (missing.length > 0) throw reason(BadRequestException, 'details_missing');
      await this.grant(client, account.id, request.role);
      await this.accounts.saveProviderDetails(client, account.id, request);
      await this.audit.record(
        { action: 'account.role.granted', entity: ENTITY, entityId: account.id },
        client,
      );
    });
  }

  /** A re-verification code to the account's own number (AC-05); synthetic accounts have none. */
  async startReverification(principal: Principal, origin: OtpOrigin): Promise<IssuedChallenge> {
    const account = await this.load(principal.userId);
    if (!account.mobile) throw reason(ConflictException, 'no_mobile');
    const mobile = await this.encryptor.decrypt(account.mobile);
    const target = {
      mobile,
      purpose: 'reverify' as const,
      accountId: account.id,
      locale: account.locale,
    };
    return this.otp.issue(target, origin);
  }

  private async grant(client: TransactionClient, accountId: string, role: RegistrableRole) {
    const side = sideOf(role);
    const applicationStatus: ApplicationStatus | null =
      side === 'provider' ? NEW_PROVIDER_STATUS : null;
    await this.accounts.grantRole(client, accountId, { role, side, applicationStatus });
  }

  private async load(id: string): Promise<AccountRecord> {
    const account = await this.accounts.find(id);
    if (!account) throw reason(ForbiddenException, 'account_missing');
    return account;
  }

  private async record(action: string, accountId: string): Promise<void> {
    await this.audit.record({ action, entity: ENTITY, entityId: accountId });
  }
}
