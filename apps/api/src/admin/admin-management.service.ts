import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_SESSIONS } from '../auth/auth.module.js';
import type { SessionService } from '../auth/session.service.js';
import { reason } from '../common/error-response.js';
import type { AdminRole, Principal } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import { AdminAccountRepository, type AdminSummary } from './admin-account.repository.js';
import { hashPassword, newTemporaryPassword } from './password.js';

const ENTITY = 'admin_account';

/** What a change does to the target once its locks are held; false means nothing changed. */
type Change = (client: TransactionClient) => Promise<boolean>;

/**
 * Admin accounts managed by super admins (AD-01, owner decision O-2): create, change sub-role,
 * disable and enable, reset a password or MFA. Every route needs a fresh TOTP. No admin changes
 * their own account here (no self-escalation), the last active super admin can never be demoted
 * or disabled, and every change signs the target out of every device. Audit entries name the
 * target, never a password or secret.
 */
@Injectable()
export class AdminManagementService {
  constructor(
    private readonly admins: AdminAccountRepository,
    @Inject(ADMIN_SESSIONS) private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  list(): Promise<AdminSummary[]> {
    return this.admins.list();
  }

  /** The temporary password is returned once, to be passed on securely; it expires (O-2). */
  async create(email: string, role: AdminRole) {
    const temporaryPassword = newTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const id = await withTransaction(this.pool, async (client) => {
      const normalised = email.trim().toLowerCase();
      const created = await this.admins.createWithTemporaryPassword(client, {
        email: normalised,
        passwordHash,
        role,
      });
      if (!created) throw reason(ConflictException, 'email_in_use');
      await this.audit.record(
        { action: 'admin.account.created', entity: ENTITY, entityId: created },
        client,
      );
      return created;
    });
    return { id, temporaryPassword };
  }

  async changeRole(principal: Principal, id: string, role: AdminRole): Promise<void> {
    await this.change(principal, id, 'admin.account.role_changed', {
      removesSuperAdmin: role !== 'super_admin',
      apply: (client) => this.admins.setRole(client, id, role),
    });
  }

  async setStatus(principal: Principal, id: string, status: 'active' | 'disabled') {
    const action = status === 'active' ? 'admin.account.enabled' : 'admin.account.disabled';
    await this.change(principal, id, action, {
      removesSuperAdmin: status === 'disabled',
      apply: (client) => this.admins.setStatus(client, id, status),
    });
  }

  async resetPassword(principal: Principal, id: string): Promise<{ temporaryPassword: string }> {
    const temporaryPassword = newTemporaryPassword();
    const hash = await hashPassword(temporaryPassword);
    await this.change(principal, id, 'admin.account.password_reset', {
      removesSuperAdmin: false,
      apply: async (client) => {
        await this.admins.setPassword(id, hash, true, client);
        return true;
      },
    });
    return { temporaryPassword };
  }

  async resetMfa(principal: Principal, id: string): Promise<void> {
    await this.change(principal, id, 'admin.account.mfa_reset', {
      removesSuperAdmin: false,
      apply: async (client) => {
        await this.admins.resetMfa(client, id);
        return true;
      },
    });
  }

  private async change(
    principal: Principal,
    id: string,
    action: string,
    change: { removesSuperAdmin: boolean; apply: Change },
  ): Promise<void> {
    if (id === principal.userId) throw reason(ConflictException, 'self_change_refused');
    await withTransaction(this.pool, async (client) => {
      const superAdmins = await this.admins.lockForChange(client, id);
      if (!(await this.admins.findById(id, client))) throw new NotFoundException();
      const lastOne = superAdmins.length === 1 && superAdmins[0] === id;
      if (change.removesSuperAdmin && lastOne) throw reason(ConflictException, 'last_super_admin');
      if (!(await change.apply(client))) throw reason(ConflictException, 'status_unchanged');
      await this.audit.record({ action, entity: ENTITY, entityId: id }, client);
    });
    await this.sessions.signOutEverywhere(id);
  }
}
