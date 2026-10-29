import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { StaffRole } from '../accounts/setup-rules.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';

export type OrganisationKind = 'lab' | 'clinic';
export type MembershipStatus =
  'invited' | 'active' | 'declined' | 'revoked' | 'removed' | 'expired';
/** How an open membership ends: revoked before acceptance, removed after, or left by the member. */
export type MembershipEnd = 'declined' | 'revoked' | 'removed';

export interface Organisation {
  id: string;
  kind: OrganisationKind;
  ownerAccountId: string;
  name: string;
  /** The owner's provider application is approved and the owner's account is active (O-1). */
  approved: boolean;
}

export interface MembershipRow {
  id: string;
  organisation_id: string;
  role: StaffRole;
  invited_mobile: EncryptedField;
  invited_mobile_index: string;
  account_id: string | null;
  status: MembershipStatus;
  invited_at: Date;
  expires_at: Date;
  accepted_at: Date | null;
}

type Queryable = Pick<pg.Pool, 'query'>;

/** Invitations stay open this long (O-1). */
export const INVITATION_TTL_DAYS = 7;
/** Open invitations an organisation may have at once (bounds abuse of the invite form). */
export const MAX_OPEN_INVITATIONS = 20;

const ORGANISATION_COLUMNS = `o.id, o.kind, o.owner_account_id, o.name,
  (a.status = 'active' AND r.application_status = 'approved') AS approved`;
const ORGANISATION_FROM = `app.organisation o
  JOIN app.account a ON a.id = o.owner_account_id
  LEFT JOIN app.role_assignment r ON r.account_id = o.owner_account_id AND r.side = 'provider'`;
const MEMBERSHIP_COLUMNS = `m.id, m.organisation_id, m.role, m.invited_mobile, m.invited_mobile_index,
  m.account_id, CASE WHEN m.status = 'invited' AND m.expires_at <= now() THEN 'expired'
  ELSE m.status END AS status, m.invited_at, m.expires_at, m.accepted_at`;

/** Organisations (labs, clinics) and their staff memberships (owner decision O-1). */
@Injectable()
export class MembershipRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async organisationOf(ownerId: string, client: Queryable = this.pool) {
    return this.oneOrganisation('o.owner_account_id = $1', ownerId, client);
  }

  async organisation(id: string, client: Queryable = this.pool) {
    return this.oneOrganisation('o.id = $1', id, client);
  }

  /** Creates the owner's organisation once; a second call returns the first. */
  async ensureOrganisation(
    ownerId: string,
    kind: OrganisationKind,
    name: string,
  ): Promise<Organisation> {
    await this.pool.query(
      `INSERT INTO app.organisation (id, kind, owner_account_id, name) VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_account_id) DO NOTHING`,
      [randomUUID(), kind, ownerId, name],
    );
    const organisation = await this.organisationOf(ownerId);
    if (!organisation) throw new Error('organisation missing after insert');
    return organisation;
  }

  async renameOrganisation(ownerId: string, name: string): Promise<void> {
    await this.pool.query('UPDATE app.organisation SET name = $2 WHERE owner_account_id = $1', [
      ownerId,
      name,
    ]);
  }

  async members(organisationId: string): Promise<MembershipRow[]> {
    const { rows } = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS} FROM app.membership m
        WHERE m.organisation_id = $1
          AND (m.status = 'active' OR (m.status = 'invited' AND m.expires_at > now()))
        ORDER BY m.invited_at`,
      [organisationId],
    );
    return rows;
  }

  async countOpenInvitations(client: TransactionClient, organisationId: string): Promise<number> {
    const { rows } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.membership
        WHERE organisation_id = $1 AND status = 'invited' AND expires_at > now()`,
      [organisationId],
    );
    return rows[0]?.n ?? 0;
  }

  /** Closes invitations past their expiry, so the one-open index admits a new invitation. */
  async expireStale(client: Queryable, organisationId?: string): Promise<number> {
    const result = await client.query(
      `UPDATE app.membership SET status = 'expired', ended_at = now()
        WHERE status = 'invited' AND expires_at <= now()
          AND ($1::uuid IS NULL OR organisation_id = $1)`,
      [organisationId ?? null],
    );
    return result.rowCount ?? 0;
  }

  /** False when the number already has an open invitation or membership here. */
  async invite(
    client: TransactionClient,
    invitation: {
      organisationId: string;
      role: StaffRole;
      mobile: EncryptedField;
      mobileIndex: string;
      invitedBy: string;
    },
  ): Promise<string | undefined> {
    const id = randomUUID();
    const result = await client.query(
      `INSERT INTO app.membership
         (id, organisation_id, role, invited_mobile, invited_mobile_index, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $7))
       ON CONFLICT DO NOTHING`,
      [
        id,
        invitation.organisationId,
        invitation.role,
        invitation.mobile,
        invitation.mobileIndex,
        invitation.invitedBy,
        INVITATION_TTL_DAYS,
      ],
    );
    return result.rowCount === 1 ? id : undefined;
  }

  /** Open invitations addressed to this number, with their organisation. */
  async invitationsFor(
    mobileIndex: string,
  ): Promise<(MembershipRow & { name: string; kind: OrganisationKind })[]> {
    const { rows } = await this.pool.query<
      MembershipRow & { name: string; kind: OrganisationKind }
    >(
      `SELECT ${MEMBERSHIP_COLUMNS}, o.name, o.kind FROM app.membership m
         JOIN app.organisation o ON o.id = m.organisation_id
        WHERE m.invited_mobile_index = $1 AND m.status = 'invited' AND m.expires_at > now()
        ORDER BY m.invited_at`,
      [mobileIndex],
    );
    return rows;
  }

  async lock(client: TransactionClient, id: string): Promise<MembershipRow | undefined> {
    const { rows } = await client.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS} FROM app.membership m WHERE m.id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0];
  }

  /** The account's number as a blind index; invitations are addressed to it. */
  async mobileIndexOf(
    accountId: string,
    client: Queryable = this.pool,
  ): Promise<string | undefined> {
    const { rows } = await client.query<{ mobile_index: string | null }>(
      'SELECT mobile_index FROM app.account WHERE id = $1',
      [accountId],
    );
    return rows[0]?.mobile_index ?? undefined;
  }

  async activeFor(accountId: string, client: Queryable = this.pool) {
    const { rows } = await client.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS} FROM app.membership m
        WHERE m.account_id = $1 AND m.status = 'active'`,
      [accountId],
    );
    return rows[0];
  }

  /**
   * Binds the invitation to the account and grants its staff role, in the caller's transaction.
   * A collector keeps an application of their own (Draft, PO-04); front desk staff have none.
   */
  async activate(client: TransactionClient, membership: MembershipRow, accountId: string) {
    await client.query(
      `UPDATE app.membership SET status = 'active', account_id = $2, accepted_at = now()
        WHERE id = $1`,
      [membership.id, accountId],
    );
    await client.query(
      `INSERT INTO app.role_assignment (account_id, side, role, application_status, granted_by)
       VALUES ($1, 'provider', $2, $3, 'membership')`,
      [accountId, membership.role, membership.role === 'sample_collector' ? 'draft' : null],
    );
  }

  /** Ends an open membership; an active one also loses its staff role grant. */
  async end(client: TransactionClient, membership: MembershipRow, end: MembershipEnd) {
    await client.query(`UPDATE app.membership SET status = $2, ended_at = now() WHERE id = $1`, [
      membership.id,
      end,
    ]);
    if (membership.status !== 'active' || !membership.account_id) return;
    await client.query(
      `DELETE FROM app.role_assignment
        WHERE account_id = $1 AND role = $2 AND granted_by = 'membership'`,
      [membership.account_id, membership.role],
    );
  }

  private async oneOrganisation(
    where: string,
    value: string,
    client: Queryable,
  ): Promise<Organisation | undefined> {
    const { rows } = await client.query<{
      id: string;
      kind: OrganisationKind;
      owner_account_id: string;
      name: string;
      approved: boolean | null;
    }>(`SELECT ${ORGANISATION_COLUMNS} FROM ${ORGANISATION_FROM} WHERE ${where}`, [value]);
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      kind: row.kind,
      ownerAccountId: row.owner_account_id,
      name: row.name,
      approved: row.approved === true,
    };
  }
}
