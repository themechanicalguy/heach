import type { FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { LinkedPatientsRepository } from '../linked-patients/linked-patients.repository.js';
import { InvitationsService } from '../organisations/invitations.service.js';
import {
  type AccountRecord,
  AccountRepository,
  type ProfileCorrection,
} from './account.repository.js';
import type { AccountExportDto } from './accounts.dto.js';
import { isStaffRole } from './setup-rules.js';

const ENTITY = 'account';

/**
 * The account holder's rights over their own data (AC-06, PR-04): correct basic details,
 * download everything held, and ask for deletion. Export and deletion need a fresh OTP (AC-05).
 * Carrying out a deletion is not built: its deadline and what must be kept wait on the lawyer
 * (default D-3).
 */
@Injectable()
export class AccountDataService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly linked: LinkedPatientsRepository,
    private readonly invitations: InvitationsService,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async correctProfile(principal: Principal, change: ProfileCorrection): Promise<void> {
    await this.accounts.transaction(async (client) => {
      const account = await this.accounts.lockForSetup(client, principal.userId);
      if (!account?.setupCompletedAt) throw reason(ConflictException, 'setup_incomplete');
      assertFitsRoles(account, change);
      await this.accounts.correctProfile(client, account.id, change);
      if (change.organisationName) {
        await client.query(
          `UPDATE app.organisation SET name = $2 WHERE owner_account_id = $1 AND kind = 'lab'`,
          [account.id, change.organisationName],
        );
      }
      await this.audit.record(
        { action: 'account.profile.corrected', entity: ENTITY, entityId: account.id },
        client,
      );
    });
  }

  async exportData(principal: Principal): Promise<AccountExportDto> {
    const account = await this.load(principal.userId);
    const [consents, linkedPatients, membership] = await Promise.all([
      this.accounts.consentHistory(account.id),
      this.linked.list(account.id),
      this.invitations.membership(account.id),
    ]);
    await this.audit.record({ action: 'account.exported', entity: ENTITY, entityId: account.id });
    return {
      exportedAt: new Date().toISOString(),
      mobile: account.mobile ? await this.encryptor.decrypt(account.mobile) : '',
      locale: account.locale,
      profile: { ...account.draft, languages: [...account.draft.languages] },
      roles: account.roles,
      consents: consents.map((row) => ({
        purpose: row.purpose,
        version: row.version,
        locale: row.locale,
        givenAt: row.given_at.toISOString(),
        withdrawnAt: row.withdrawn_at?.toISOString() ?? null,
      })),
      membership,
      linkedPatients,
      deletionRequestedAt: account.deletionRequestedAt?.toISOString() ?? null,
    };
  }

  /** A repeated request keeps the open one (idempotent). */
  async requestDeletion(principal: Principal): Promise<void> {
    await this.accounts.transaction(async (client) => {
      if (!(await this.accounts.requestDeletion(client, principal.userId))) return;
      await this.audit.record(
        { action: 'account.deletion.requested', entity: ENTITY, entityId: principal.userId },
        client,
      );
    });
  }

  async cancelDeletion(principal: Principal): Promise<void> {
    await this.accounts.transaction(async (client) => {
      if (!(await this.accounts.cancelDeletion(client, principal.userId))) {
        throw reason(ConflictException, 'no_deletion_request');
      }
      await this.audit.record(
        { action: 'account.deletion.cancelled', entity: ENTITY, entityId: principal.userId },
        client,
      );
    });
  }

  private async load(id: string): Promise<AccountRecord> {
    const account = await this.accounts.find(id);
    if (!account) throw reason(ForbiddenException, 'account_missing');
    return account;
  }
}

/**
 * A field is corrected only where the account's roles use it: the lab's name for a lab, spoken
 * languages for a provider who lists services (never emptied).
 */
function assertFitsRoles(account: AccountRecord, change: ProfileCorrection): void {
  const provider = account.roles.find((grant) => grant.side === 'provider');
  if (change.organisationName && provider?.role !== 'lab') {
    throw reason(BadRequestException, 'field_not_for_role');
  }
  if (!change.languages) return;
  if (!provider || isStaffRole(provider.role)) {
    throw reason(BadRequestException, 'field_not_for_role');
  }
  if (change.languages.length === 0) throw reason(BadRequestException, 'details_missing');
}
