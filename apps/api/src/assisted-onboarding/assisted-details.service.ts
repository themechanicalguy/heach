import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type AccountRecord, AccountRepository } from '../accounts/account.repository.js';
import { missingFields, type SetupDraft, sideOf } from '../accounts/setup-rules.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { RoleAvailability } from '../flags/role-availability.js';
import { EDITABLE } from '../onboarding/application-rules.js';
import type { AssistedDetailsDto } from './assisted-onboarding.dto.js';
import { ASSISTED_ROLES } from './assisted-rules.js';

const ENTITY = 'account';

/**
 * The provider's basic details and provider type, entered by a support admin (AD-12). A new
 * account finishes setup here; a care account that already finished setup only gains its
 * provider side and keeps the name it has. Terms and privacy are not recorded: the provider
 * accepts them at their own first sign-in.
 */
@Injectable()
export class AssistedDetailsService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly roles: RoleAvailability,
    private readonly audit: AuditService,
  ) {}

  async save(accountId: string, dto: AssistedDetailsDto): Promise<void> {
    if (
      !(ASSISTED_ROLES as readonly string[]).includes(dto.role) ||
      !this.roles.isOffered(dto.role)
    ) {
      throw reason(BadRequestException, 'role_unavailable');
    }
    await this.accounts.transaction(async (client) => {
      const account = await this.accounts.lockForSetup(client, accountId);
      if (!account) throw new NotFoundException();
      if (account.setupCompletedAt) await this.addProviderSide(client, account, dto);
      else await this.completeSetup(client, account, dto);
    });
  }

  private async completeSetup(
    client: TransactionClient,
    account: AccountRecord,
    dto: AssistedDetailsDto,
  ): Promise<void> {
    const draft: SetupDraft = {
      role: dto.role,
      fullName: dto.fullName ?? null,
      gender: dto.gender ?? null,
      languages: dto.languages,
      organisationName: dto.role === 'lab' ? (dto.organisationName ?? null) : null,
      adultDeclared: dto.adultDeclared === true,
    };
    const { role, fullName, gender } = draft;
    if (missingFields(draft).length > 0 || !role || !fullName || !gender) {
      throw reason(BadRequestException, 'details_missing');
    }
    await this.accounts.saveAssistedDetails(client, account.id, {
      role,
      fullName,
      gender,
      languages: draft.languages,
      organisationName: draft.organisationName,
    });
    await this.grant(client, account.id, dto);
    await this.accounts.markSetupComplete(client, account.id);
    await this.record('account.setup.completed', account.id, client);
  }

  private async addProviderSide(
    client: TransactionClient,
    account: AccountRecord,
    dto: AssistedDetailsDto,
  ): Promise<void> {
    if (dto.fullName !== undefined || dto.gender !== undefined || dto.adultDeclared !== undefined) {
      throw reason(BadRequestException, 'details_locked');
    }
    const organisationName = dto.role === 'lab' ? dto.organisationName : undefined;
    const held = account.roles.find((grant) => grant.side === 'provider');
    if (held) {
      if (held.role !== dto.role) throw reason(ConflictException, 'side_taken');
      if (!held.applicationStatus || !EDITABLE.includes(held.applicationStatus)) {
        throw reason(ConflictException, 'application_not_editable');
      }
    } else {
      const missing = missingFields({
        ...account.draft,
        role: dto.role,
        languages: dto.languages,
        organisationName: organisationName ?? account.draft.organisationName,
      });
      if (missing.length > 0) throw reason(BadRequestException, 'details_missing');
      await this.grant(client, account.id, dto);
      await this.record('account.role.granted', account.id, client);
    }
    await this.accounts.saveProviderDetails(client, account.id, {
      languages: dto.languages,
      ...(organisationName ? { organisationName } : {}),
    });
  }

  private grant(client: TransactionClient, accountId: string, dto: AssistedDetailsDto) {
    return this.accounts.grantRole(
      client,
      accountId,
      { role: dto.role, side: sideOf(dto.role), applicationStatus: 'draft' },
      'assisted-onboarding',
    );
  }

  private record(action: string, accountId: string, client: TransactionClient): Promise<void> {
    return this.audit.record({ action, entity: ENTITY, entityId: accountId }, client);
  }
}
