import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import type { Locale } from '@heach/i18n';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { GrantedUserRole } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import type { ConsentGiven } from './consent-versions.js';
import type { Gender, SetupDraft, SetupRole, Side } from './setup-rules.js';

export type AccountStatus = 'active' | 'suspended';
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface RoleGrant {
  role: GrantedUserRole;
  side: Side;
  applicationStatus: ApplicationStatus | null;
  statusReason: string | null;
}

export interface AccountRecord {
  id: string;
  mobile: EncryptedField | null;
  synthetic: boolean;
  locale: Locale;
  status: AccountStatus;
  setupCompletedAt: Date | null;
  lastActiveRole: string | null;
  draft: SetupDraft;
  /** The invitation setup will accept, when the role came from one (O-1). */
  setupInvitationId: string | null;
  roles: RoleGrant[];
  consents: ConsentGiven[];
  /** When an open deletion request was made (AC-06, default D-3). */
  deletionRequestedAt: Date | null;
}

/** Basic details a user corrects after setup (AC-06); undefined leaves a field as it is. */
export interface ProfileCorrection {
  fullName?: string;
  gender?: Gender;
  languages?: readonly string[];
  organisationName?: string;
}

/** The fields setup may save; undefined leaves a field as it is. */
export type SetupPatch = Partial<Omit<SetupDraft, 'adultDeclared'>> & { adultDeclared?: boolean };

type Queryable = Pick<pg.Pool, 'query'>;

interface AccountRow {
  id: string;
  mobile: EncryptedField | null;
  synthetic: boolean;
  preferred_locale: Locale;
  status: AccountStatus;
  setup_completed_at: Date | null;
  last_active_role: string | null;
  full_name: string | null;
  gender: Gender | null;
  languages: string[];
  organisation_name: string | null;
  adult_declared_at: Date | null;
  setup_role: SetupRole | null;
  setup_invitation_id: string | null;
  deletion_requested_at: Date | null;
}

/** Accounts of patients and providers, their setup draft, roles and consents (decisions L-1 to L-5). */
@Injectable()
export class AccountRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  /**
   * The account for this number, created on first sign-in. Two concurrent first sign-ins with the
   * same number create one account: the unique blind index decides, the loser reads the winner.
   */
  async findOrCreate(
    mobile: { mobile: EncryptedField; mobileIndex: string },
    locale: Locale,
  ): Promise<{ id: string; created: boolean }> {
    return this.transaction(async (client) => {
      const id = randomUUID();
      const inserted = await client.query(
        `INSERT INTO app.account (id, mobile, mobile_index, preferred_locale)
         VALUES ($1, $2, $3, $4) ON CONFLICT (mobile_index) DO NOTHING`,
        [id, mobile.mobile, mobile.mobileIndex, locale],
      );
      if (inserted.rowCount === 1) {
        await client.query('INSERT INTO app.account_profile (account_id) VALUES ($1)', [id]);
        return { id, created: true };
      }
      const { rows } = await client.query<{ id: string }>(
        'SELECT id FROM app.account WHERE mobile_index = $1',
        [mobile.mobileIndex],
      );
      return { id: rows[0]?.id ?? '', created: false };
    });
  }

  async find(id: string, client: Queryable = this.pool): Promise<AccountRecord | undefined> {
    const { rows } = await client.query<AccountRow>(
      `SELECT a.id, a.mobile, a.synthetic, a.preferred_locale, a.status, a.setup_completed_at,
              a.last_active_role, p.full_name, p.gender, p.languages, p.organisation_name,
              p.adult_declared_at, p.setup_role, p.setup_invitation_id,
              d.requested_at AS deletion_requested_at
         FROM app.account a JOIN app.account_profile p ON p.account_id = a.id
         LEFT JOIN app.deletion_request d ON d.account_id = a.id AND d.status = 'pending'
        WHERE a.id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return undefined;
    const [roles, consents] = await Promise.all([
      this.roles(id, client),
      this.consents(id, client),
    ]);
    return toRecord(row, roles, consents);
  }

  async roles(accountId: string, client: Queryable = this.pool): Promise<RoleGrant[]> {
    const { rows } = await client.query<{
      role: GrantedUserRole;
      side: Side;
      application_status: ApplicationStatus | null;
      status_reason: string | null;
    }>(
      `SELECT role, side, application_status, status_reason FROM app.role_assignment
        WHERE account_id = $1 ORDER BY side`,
      [accountId],
    );
    return rows.map((row) => ({
      role: row.role,
      side: row.side,
      applicationStatus: row.application_status,
      statusReason: row.status_reason,
    }));
  }

  async recordSignIn(id: string): Promise<void> {
    await this.pool.query('UPDATE app.account SET last_sign_in_at = now() WHERE id = $1', [id]);
  }

  async setLastActiveRole(id: string, role: string): Promise<void> {
    await this.pool.query('UPDATE app.account SET last_active_role = $2 WHERE id = $1', [id, role]);
  }

  async setLocale(id: string, locale: Locale): Promise<void> {
    await this.pool.query('UPDATE app.account SET preferred_locale = $2 WHERE id = $1', [
      id,
      locale,
    ]);
  }

  /**
   * Saves setup fields; false once setup is complete (nothing changes then). Choosing a role
   * clears any invitation chosen before, and choosing an invitation sets its role.
   */
  async saveDraft(
    id: string,
    patch: SetupPatch,
    invitation?: { id: string; role: SetupRole },
  ): Promise<boolean> {
    const role = invitation ? invitation.role : patch.role;
    // A role chosen directly drops an invitation chosen before; neither leaves it as it is.
    let invitationId: string | null | undefined = patch.role ? null : undefined;
    if (invitation) invitationId = invitation.id;
    const result = await this.pool.query(
      `UPDATE app.account_profile p
          SET setup_role = CASE WHEN $2 THEN $3 ELSE p.setup_role END,
              setup_invitation_id = CASE WHEN $14 THEN $15::uuid ELSE p.setup_invitation_id END,
              full_name = CASE WHEN $4 THEN $5 ELSE p.full_name END,
              gender = CASE WHEN $6 THEN $7 ELSE p.gender END,
              languages = CASE WHEN $8 THEN $9::text[] ELSE p.languages END,
              organisation_name = CASE WHEN $10 THEN $11 ELSE p.organisation_name END,
              adult_declared_at = CASE WHEN $12 THEN (CASE WHEN $13 THEN now() END)
                                       ELSE p.adult_declared_at END,
              updated_at = now()
         FROM app.account a
        WHERE p.account_id = $1 AND a.id = p.account_id AND a.setup_completed_at IS NULL`,
      [
        id,
        ...field(role),
        ...field(patch.fullName),
        ...field(patch.gender),
        ...field(patch.languages ? [...patch.languages] : undefined),
        ...field(patch.organisationName),
        ...field(patch.adultDeclared),
        ...field(invitationId),
      ],
    );
    return result.rowCount === 1;
  }

  /** Corrects basic details after setup, in the caller's transaction (AC-06). */
  async correctProfile(
    client: TransactionClient,
    id: string,
    change: ProfileCorrection,
  ): Promise<void> {
    await client.query(
      `UPDATE app.account_profile
          SET full_name = coalesce($2, full_name), gender = coalesce($3, gender),
              languages = coalesce($4::text[], languages),
              organisation_name = coalesce($5, organisation_name), updated_at = now()
        WHERE account_id = $1`,
      [
        id,
        change.fullName ?? null,
        change.gender ?? null,
        change.languages ? [...change.languages] : null,
        change.organisationName ?? null,
      ],
    );
  }

  /** The new number (O-3); false when another account already has it (unique blind index). */
  async changeMobile(
    client: TransactionClient,
    id: string,
    mobile: { mobile: EncryptedField; mobileIndex: string },
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE app.account SET mobile = $2, mobile_index = $3
        WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM app.account WHERE mobile_index = $3)`,
      [id, mobile.mobile, mobile.mobileIndex],
    );
    return result.rowCount === 1;
  }

  /** Opens a deletion request; an open one is kept as it is (one per account). */
  async requestDeletion(client: TransactionClient, id: string): Promise<boolean> {
    const result = await client.query(
      `INSERT INTO app.deletion_request (id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [randomUUID(), id],
    );
    return result.rowCount === 1;
  }

  async cancelDeletion(client: TransactionClient, id: string): Promise<boolean> {
    const result = await client.query(
      `UPDATE app.deletion_request SET status = 'cancelled', closed_at = now()
        WHERE account_id = $1 AND status = 'pending'`,
      [id],
    );
    return result.rowCount === 1;
  }

  /** Every consent record of the account, withdrawn ones too, for the data export (PR-04). */
  async consentHistory(id: string) {
    const { rows } = await this.pool.query<{
      purpose: string;
      version: string;
      locale: string;
      given_at: Date;
      withdrawn_at: Date | null;
    }>(
      `SELECT purpose, version, locale, given_at, withdrawn_at FROM app.consent_record
        WHERE account_id = $1 ORDER BY given_at`,
      [id],
    );
    return rows;
  }

  /** Locks the account row until commit, so two setup completions cannot both grant a role. */
  async lockForSetup(client: TransactionClient, id: string): Promise<AccountRecord | undefined> {
    await client.query('SELECT 1 FROM app.account WHERE id = $1 FOR UPDATE', [id]);
    return this.find(id, client);
  }

  async grantRole(
    client: TransactionClient,
    accountId: string,
    grant: { role: GrantedUserRole; side: Side; applicationStatus: ApplicationStatus | null },
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.role_assignment (account_id, side, role, application_status, granted_by)
       VALUES ($1, $2, $3, $4, 'self-registration')`,
      [accountId, grant.side, grant.role, grant.applicationStatus],
    );
  }

  /** Details a provider side needs, given when a care account adds it. */
  async saveProviderDetails(
    client: TransactionClient,
    id: string,
    details: { languages?: readonly string[]; organisationName?: string },
  ): Promise<void> {
    await client.query(
      `UPDATE app.account_profile
          SET languages = coalesce($2::text[], languages),
              organisation_name = coalesce($3, organisation_name), updated_at = now()
        WHERE account_id = $1`,
      [id, details.languages ? [...details.languages] : null, details.organisationName ?? null],
    );
  }

  async markSetupComplete(client: TransactionClient, id: string): Promise<void> {
    await client.query('UPDATE app.account SET setup_completed_at = now() WHERE id = $1', [id]);
  }

  /** Records each consent once; a repeated submission of the same version is a no-op. */
  async recordConsents(
    client: TransactionClient,
    accountId: string,
    consents: readonly ConsentGiven[],
    locale: Locale,
  ): Promise<void> {
    for (const consent of consents) {
      await client.query(
        `INSERT INTO app.consent_record (id, account_id, purpose, version, locale)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [randomUUID(), accountId, consent.purpose, consent.version, locale],
      );
    }
  }

  private async consents(accountId: string, client: Queryable): Promise<ConsentGiven[]> {
    const { rows } = await client.query<ConsentGiven>(
      `SELECT purpose, version FROM app.consent_record
        WHERE account_id = $1 AND withdrawn_at IS NULL`,
      [accountId],
    );
    return rows;
  }
}

/** [present, value]: lets one UPDATE leave absent fields unchanged. */
function field<T>(value: T | undefined): [boolean, T | null] {
  return value === undefined ? [false, null] : [true, value];
}

function toRecord(row: AccountRow, roles: RoleGrant[], consents: ConsentGiven[]): AccountRecord {
  return {
    id: row.id,
    mobile: row.mobile,
    synthetic: row.synthetic,
    locale: row.preferred_locale,
    status: row.status,
    setupCompletedAt: row.setup_completed_at,
    lastActiveRole: row.last_active_role,
    draft: {
      role: row.setup_role,
      fullName: row.full_name,
      gender: row.gender,
      languages: row.languages,
      organisationName: row.organisation_name,
      adultDeclared: row.adult_declared_at !== null,
    },
    setupInvitationId: row.setup_invitation_id,
    roles,
    consents,
    deletionRequestedAt: row.deletion_requested_at,
  };
}
