import type { BlindIndexer, FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import type { StaffRole } from '../accounts/setup-rules.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { BLIND_INDEXER, FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { maskMobile, normaliseIndianMobile } from '../otp/mobile-number.js';
import {
  MAX_OPEN_INVITATIONS,
  MembershipRepository,
  type MembershipRow,
  type Organisation,
  type OrganisationKind,
} from './membership.repository.js';
import type { MemberDto, OrganisationDto } from './organisations.dto.js';

/** Which provider roles run an organisation, and the staff role it may invite (O-1). */
const OWNER_KINDS: Partial<Record<string, OrganisationKind>> = {
  lab: 'lab',
  dentist: 'clinic',
  dermatologist: 'clinic',
};
const STAFF_ROLE: Record<OrganisationKind, StaffRole> = {
  lab: 'sample_collector',
  clinic: 'clinic_front_desk',
};
const ENTITY = 'membership';

/**
 * A lab's or clinic's owner manages its staff (owner decision O-1): invite by mobile number,
 * revoke an invitation, remove a member. Every action is on the caller's own organisation, found
 * from the session, never from an ID in the request (SE-02).
 */
@Injectable()
export class OrganisationsService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    @Inject(BLIND_INDEXER) private readonly indexer: BlindIndexer,
  ) {}

  async view(principal: Principal): Promise<OrganisationDto> {
    const kind = kindFor(principal);
    const organisation = await this.existing(principal, kind);
    const members = organisation ? await this.memberships.members(organisation.id) : [];
    return {
      kind,
      name: organisation?.name ?? null,
      approved: organisation?.approved ?? false,
      staffRole: STAFF_ROLE[kind],
      members: await Promise.all(members.map((row) => this.member(row))),
    };
  }

  /** Names a clinic (or renames it); a lab keeps the name given at setup. */
  async name(principal: Principal, name: string): Promise<void> {
    if (kindFor(principal) !== 'clinic') throw reason(ConflictException, 'lab_named_at_setup');
    const existing = await this.memberships.organisationOf(principal.userId);
    if (existing) await this.memberships.renameOrganisation(principal.userId, name);
    else await this.memberships.ensureOrganisation(principal.userId, 'clinic', name);
    await this.record('organisation.named', principal.userId);
  }

  /** The route requires a fresh OTP. No SMS goes to the person invited (default D-6). */
  async invite(principal: Principal, mobileInput: string): Promise<void> {
    const kind = kindFor(principal);
    const organisation = await this.existing(principal, kind);
    if (!organisation) throw reason(ConflictException, 'organisation_unnamed');
    const mobile = normaliseIndianMobile(mobileInput);
    if (!mobile) throw reason(BadRequestException, 'mobile_invalid');
    const mobileIndex = this.indexer.index('identity', mobile);
    if (await this.isOwnNumber(principal.userId, mobileIndex)) {
      throw reason(ConflictException, 'cannot_invite_self');
    }
    const encrypted = await this.encryptor.encrypt(mobile, 'identity');
    await this.memberships.transaction(async (client) => {
      await client.query('SELECT 1 FROM app.organisation WHERE id = $1 FOR UPDATE', [
        organisation.id,
      ]);
      await this.memberships.expireStale(client, organisation.id);
      if (
        (await this.memberships.countOpenInvitations(client, organisation.id)) >=
        MAX_OPEN_INVITATIONS
      ) {
        throw reason(ConflictException, 'invitation_limit');
      }
      const invitation = { organisationId: organisation.id, role: STAFF_ROLE[kind] };
      const created = await this.memberships.invite(client, {
        ...invitation,
        mobile: encrypted,
        mobileIndex,
        invitedBy: principal.userId,
      });
      if (!created) throw reason(ConflictException, 'already_invited');
      await this.audit.record(
        { action: 'membership.invited', entity: ENTITY, entityId: created },
        client,
      );
    });
  }

  /**
   * Revokes an invitation or removes a member. A removed member loses the staff role at once:
   * every device acting in it is signed out (revocation policy D-7).
   */
  async end(principal: Principal, membershipId: string): Promise<void> {
    const organisation = await this.memberships.organisationOf(principal.userId);
    const ended = await this.memberships.transaction(async (client) => {
      const row = await this.memberships.lock(client, membershipId);
      if (!organisation || row?.organisation_id !== organisation.id) throw new NotFoundException();
      if (row.status !== 'invited' && row.status !== 'active') {
        throw reason(ConflictException, 'membership_closed');
      }
      const end = row.status === 'active' ? 'removed' : 'revoked';
      await this.memberships.end(client, row, end);
      await this.audit.record(
        { action: `membership.${end}`, entity: ENTITY, entityId: row.id },
        client,
      );
      return row;
    });
    if (ended.status === 'active' && ended.account_id) {
      await this.sessions.signOutRole(ended.account_id, ended.role);
    }
  }

  /** A lab's organisation is made from its setup name the first time it is needed. */
  private async existing(
    principal: Principal,
    kind: OrganisationKind,
  ): Promise<Organisation | undefined> {
    const organisation = await this.memberships.organisationOf(principal.userId);
    if (organisation || kind !== 'lab') return organisation;
    const { rows } = await this.pool.query<{ organisation_name: string | null }>(
      'SELECT organisation_name FROM app.account_profile WHERE account_id = $1',
      [principal.userId],
    );
    const name = rows[0]?.organisation_name;
    return name ? this.memberships.ensureOrganisation(principal.userId, 'lab', name) : undefined;
  }

  private async isOwnNumber(accountId: string, mobileIndex: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'SELECT 1 FROM app.account WHERE id = $1 AND mobile_index = $2',
      [accountId, mobileIndex],
    );
    return rowCount === 1;
  }

  private async member(row: MembershipRow): Promise<MemberDto> {
    return {
      id: row.id,
      role: row.role,
      status: row.status === 'active' ? 'active' : 'invited',
      mobile: maskMobile(await this.encryptor.decrypt(row.invited_mobile)),
      invitedAt: row.invited_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      acceptedAt: row.accepted_at?.toISOString() ?? null,
    };
  }

  private async record(action: string, accountId: string): Promise<void> {
    await this.audit.record({ action, entity: 'organisation', entityId: accountId });
  }
}

function kindFor(principal: Principal): OrganisationKind {
  const kind = OWNER_KINDS[principal.role];
  if (!kind) throw reason(ConflictException, 'not_an_organisation_owner');
  return kind;
}
