import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { StaffRole } from '../accounts/setup-rules.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { MembershipRepository, type MembershipRow } from './membership.repository.js';
import type { InvitationDto, MembershipDto } from './organisations.dto.js';

const ENTITY = 'membership';

/**
 * The invited person's side (owner decision O-1): see invitations sent to their own number,
 * accept one (which grants its staff role) or decline it. An invitation is found by its ID and
 * then must be addressed to the caller's number; anything else answers 404 (SE-02).
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly audit: AuditService,
  ) {}

  async list(principal: Principal): Promise<InvitationDto[]> {
    const index = await this.memberships.mobileIndexOf(principal.userId);
    if (!index) return [];
    const rows = await this.memberships.invitationsFor(index);
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      organisationKind: row.kind,
      organisationName: row.name,
      expiresAt: row.expires_at.toISOString(),
    }));
  }

  async membership(accountId: string): Promise<MembershipDto | null> {
    const active = await this.memberships.activeFor(accountId);
    const organisation = active && (await this.memberships.organisation(active.organisation_id));
    if (!active || !organisation) return null;
    return {
      role: active.role,
      organisationKind: organisation.kind,
      organisationName: organisation.name,
      organisationApproved: organisation.approved,
    };
  }

  /** Accepts for an account whose setup is done; the route requires a fresh OTP (L-11). */
  async accept(principal: Principal, invitationId: string): Promise<StaffRole> {
    return this.memberships.transaction(async (client) => {
      await client.query('SELECT 1 FROM app.account WHERE id = $1 FOR UPDATE', [principal.userId]);
      const { rows } = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM app.role_assignment
          WHERE account_id = $1 AND side = 'provider'`,
        [principal.userId],
      );
      if ((rows[0]?.n ?? 0) > 0) throw reason(ConflictException, 'side_taken');
      return this.acceptLocked(client, principal.userId, invitationId);
    });
  }

  /**
   * Inside the caller's transaction, with the account locked: checks the invitation is open and
   * addressed to this account's number, then binds it and grants its role.
   */
  async acceptLocked(
    client: TransactionClient,
    accountId: string,
    invitationId: string,
  ): Promise<StaffRole> {
    const row = await this.openFor(client, accountId, invitationId);
    await this.memberships.activate(client, row, accountId);
    await this.audit.record(
      { action: 'membership.accepted', entity: ENTITY, entityId: row.id },
      client,
    );
    return row.role;
  }

  async decline(principal: Principal, invitationId: string): Promise<void> {
    await this.memberships.transaction(async (client) => {
      const row = await this.openFor(client, principal.userId, invitationId);
      await this.memberships.end(client, row, 'declined');
      await this.audit.record(
        { action: 'membership.declined', entity: ENTITY, entityId: row.id },
        client,
      );
    });
  }

  /** The role an open invitation to this account carries; setup saves it as the choice. */
  async roleOf(client: TransactionClient, accountId: string, invitationId: string) {
    return (await this.openFor(client, accountId, invitationId)).role;
  }

  private async openFor(
    client: TransactionClient,
    accountId: string,
    invitationId: string,
  ): Promise<MembershipRow> {
    const index = await this.memberships.mobileIndexOf(accountId, client);
    const row = await this.memberships.lock(client, invitationId);
    if (!row || !index || row.invited_mobile_index !== index) throw new NotFoundException();
    if (row.status !== 'invited') throw reason(ConflictException, 'invitation_closed');
    return row;
  }
}
