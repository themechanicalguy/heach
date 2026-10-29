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
import { reason } from '../common/error-response.js';
import type { GrantedUserRole, Principal } from '../common/request-context.js';
import { RoleAvailability } from '../flags/role-availability.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { InvitationsService } from '../organisations/invitations.service.js';
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
  isStaffRole,
  missingFields,
  NEW_PROVIDER_STATUS,
  nextSetupStep,
  type RegistrableRole,
  SELF_REGISTRABLE_ROLES,
  type SetupRole,
  sideOf,
} from './setup-rules.js';

const ENTITY = 'account';

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
    private readonly invitations: InvitationsService,
    private readonly availability: RoleAvailability,
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
    return this.sessions.signIn(id, this.startingRole(account));
  }

  /** Test sign-in (dev and test only): synthetic accounts, never one created by OTP (L-1). */
  async signInSynthetic(id: string): Promise<IssuedTokens | undefined> {
    const account = await this.accounts.find(id);
    if (!account?.synthetic || account.status !== 'active') return undefined;
    return this.sessions.signIn(id, this.startingRole(account));
  }

  async view(principal: Principal): Promise<MeDto> {
    const account = await this.load(principal.userId);
    const complete = account.setupCompletedAt !== null;
    const [membership, invitations] = await Promise.all([
      this.invitations.membership(account.id),
      this.invitations.list(principal),
    ]);
    return {
      locale: account.locale,
      mobile: account.mobile ? maskMobile(await this.encryptor.decrypt(account.mobile)) : null,
      activeRole: principal.role,
      roles: this.availability.held(account.roles),
      offeredRoles: SELF_REGISTRABLE_ROLES.filter((role) => this.availability.isOffered(role)),
      setup: {
        complete,
        nextStep: complete ? null : this.resumeStep(account),
        draft: { ...account.draft, languages: [...account.draft.languages] },
      },
      consentsDue: consentsDue(account.consents),
      membership,
      invitations: invitations.length,
      deletionRequestedAt: account.deletionRequestedAt?.toISOString() ?? null,
    };
  }

  /**
   * Saves part of setup. An invitation chosen here must be open and addressed to this account's
   * number; its role becomes the setup choice, granted only when setup completes (O-1).
   */
  async saveSetup(
    principal: Principal,
    patch: SetupPatch & { invitationId?: string },
  ): Promise<void> {
    const { invitationId, ...fields } = patch;
    if (fields.role) this.assertOffered(fields.role);
    const invitation = invitationId
      ? {
          id: invitationId,
          role: await this.accounts.transaction((client) =>
            this.invitations.roleOf(client, principal.userId, invitationId),
          ),
        }
      : undefined;
    if (invitation) this.assertOffered(invitation.role);
    if (!(await this.accounts.saveDraft(principal.userId, fields, invitation))) {
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
      // A draft saved while a deferred role was offered is not granted once it is not.
      this.assertOffered(requested);
      await this.grantSetupRole(client, account, requested);
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

  /**
   * Only to a role the account holds now and that is offered, checked on the server (decision
   * L-3, ADR 0015).
   */
  async switchRole(
    principal: Principal,
    accessToken: string,
    role: GrantedUserRole,
  ): Promise<string> {
    const roles = await this.accounts.roles(principal.userId);
    const denial = !roles.some((grant) => grant.role === role)
      ? 'role_not_granted'
      : !this.availability.isOffered(role) && 'role_unavailable';
    if (denial) {
      await this.record('account.role.switch.denied', principal.userId);
      throw reason(ForbiddenException, denial);
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
    this.assertOffered(request.role);
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

  /** A role deferred beyond the MVP is refused while it is not offered (ADR 0015). */
  private assertOffered(role: string): void {
    if (!this.availability.isOffered(role)) throw reason(BadRequestException, 'role_unavailable');
  }

  /**
   * The role a sign-in starts in, from the grants that are offered now. An account whose only
   * grants are deferred starts with no role (`new_account`): it keeps its data and may add a role.
   */
  private startingRole(account: AccountRecord) {
    const usable = account.roles.filter((grant) => this.availability.isOffered(grant.role));
    return initialRole(usable, account.lastActiveRole);
  }

  /** A draft whose role is no longer offered resumes at the role step, to choose another. */
  private resumeStep(account: AccountRecord) {
    const role = account.draft.role;
    return role && !this.availability.isOffered(role) ? 'role' : nextSetupStep(account.draft);
  }

  /** A staff role only through its still-open invitation; any other role by the setup rules. */
  private async grantSetupRole(client: TransactionClient, account: AccountRecord, role: SetupRole) {
    if (!isStaffRole(role)) return this.grant(client, account.id, role);
    if (!account.setupInvitationId) throw reason(BadRequestException, 'setup_incomplete');
    await this.invitations.acceptLocked(client, account.id, account.setupInvitationId);
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
