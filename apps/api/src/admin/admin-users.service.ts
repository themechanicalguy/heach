import type { BlindIndexer, FieldEncryptor } from '@heach/crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';
import { BLIND_INDEXER, FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { RoleAvailability } from '../flags/role-availability.js';
import { maskMobile, normaliseIndianMobile } from '../otp/mobile-number.js';
import type { SuspensionReason, UserDetailDto, UserPageDto, UserSummaryDto } from './admin.dto.js';
import { AdminUsersRepository, type UserSummaryRow } from './admin-users.repository.js';
import { maskName } from './masking.js';

export const PAGE_SIZE = 25;
const ENTITY = 'account';

/**
 * User management for admins (AD-03): masked lists, an audited detail view, suspend and reinstate
 * with a reason. A suspension signs the account out of every device at once.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly users: AdminUsersRepository,
    private readonly userSessions: SessionService,
    private readonly audit: AuditService,
    private readonly availability: RoleAvailability,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    @Inject(BLIND_INDEXER) private readonly indexer: BlindIndexer,
  ) {}

  async list(query: {
    q?: string;
    status?: 'active' | 'suspended';
    page?: number;
  }): Promise<UserPageDto> {
    const page = query.page ?? 1;
    const mobile = query.q ? normaliseIndianMobile(query.q) : undefined;
    const result = await this.users.search({
      ...(mobile ? { mobileIndex: this.indexer.index('identity', mobile) } : {}),
      ...(query.q && !mobile ? { name: query.q.trim() } : {}),
      ...(query.status ? { status: query.status } : {}),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    await this.audit.record({ action: 'admin.users.list', entity: ENTITY, entityId: null });
    return {
      items: await Promise.all(result.rows.map((row) => this.summary(row))),
      total: result.total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async view(id: string): Promise<UserDetailDto> {
    const row = await this.users.find(id);
    if (!row) throw new NotFoundException();
    await this.audit.record({ action: 'admin.user.view', entity: ENTITY, entityId: id });
    return Object.assign(await this.summary(row), {
      fullName: row.full_name,
      deletionRequestedAt: row.deletion_requested_at?.toISOString() ?? null,
    });
  }

  async suspend(id: string, reason: SuspensionReason): Promise<void> {
    await this.changeStatus(id, { status: 'suspended', reason }, 'admin.user.suspended');
    await this.userSessions.signOutEverywhere(id);
  }

  async reinstate(id: string): Promise<void> {
    await this.changeStatus(id, { status: 'active', reason: null }, 'admin.user.reinstated');
  }

  /** The change and its audit entry commit together (SE-05). */
  private async changeStatus(
    id: string,
    change: { status: 'active' | 'suspended'; reason: SuspensionReason | null },
    action: string,
  ): Promise<void> {
    if (!(await this.users.find(id))) throw new NotFoundException();
    const changed = await this.users.transaction(async (client) => {
      if (!(await this.users.setStatus(client, id, change))) return false;
      await this.audit.record({ action, entity: ENTITY, entityId: id }, client);
      return true;
    });
    if (!changed) {
      throw new ConflictException({
        error: 'Conflict',
        message: 'status_unchanged',
        code: 'status_unchanged',
      });
    }
  }

  private async summary(row: UserSummaryRow): Promise<UserSummaryDto> {
    return {
      id: row.id,
      name: maskName(row.full_name),
      mobile: row.mobile ? maskMobile(await this.encryptor.decrypt(row.mobile)) : null,
      status: row.status,
      suspensionReason: row.suspension_reason,
      roles: this.availability.held(row.roles),
      setupComplete: row.setup_completed_at !== null,
      createdAt: row.created_at.toISOString(),
      lastSignInAt: row.last_sign_in_at?.toISOString() ?? null,
    };
  }
}
