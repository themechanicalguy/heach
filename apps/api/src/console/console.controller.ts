import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { PG_POOL, REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import { dayKey } from '../security/unusual-read.monitor.js';
import { requireFlag } from '../flags/flags.module.js';
import { Settings } from '../settings/settings.service.js';
import { DashboardDto, SecurityDto, SettingDto, SettingInputDto } from './console.dto.js';

interface Count {
  label: string;
  count: number;
}

/**
 * The admin console: operations settings (AD-08), the business dashboard (AD-10) and the
 * security console (AD-17). Counts only, never personal or health data.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1')
@UseGuards(requireFlag('accounts'))
export class ConsoleController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    private readonly settings: Settings,
    private readonly audit: AuditService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('settings')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'finance', 'support')
  @ApiOkResponse({ type: [SettingDto] })
  async list(): Promise<SettingDto[]> {
    const all = await this.settings.all();
    return Object.entries(all).map(([key, value]) => ({ key, value }));
  }

  /** Changing a policy needs a fresh TOTP code, like every sensitive admin change (AC-05). */
  @Put('settings')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  async set(@Body() body: SettingInputDto): Promise<void> {
    await this.settings.set(body.key, body.value);
    await this.audit.record({ action: 'setting.changed', entity: 'setting', entityId: body.key });
  }

  @Get('dashboard')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support', 'finance', 'verifier')
  @ApiOkResponse({ type: DashboardDto })
  async dashboard(): Promise<DashboardDto> {
    const count = async (sql: string): Promise<Count[]> => (await this.pool.query<Count>(sql)).rows;
    const [signUps, byRole, byDistrict, byService, byStatus, revenue] = await Promise.all([
      this.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM app.account'),
      count(
        `SELECT role AS label, count(*)::int AS count FROM app.role_assignment WHERE side = 'provider' AND application_status = 'approved' GROUP BY role ORDER BY role`,
      ),
      count(
        `SELECT pc.district AS label, count(DISTINCT sa.account_id)::int AS count FROM app.service_area sa JOIN app.pin_code pc ON pc.pin = sa.pin GROUP BY pc.district ORDER BY pc.district`,
      ),
      count(
        `SELECT i.service AS label, count(*)::int AS count FROM app.booking b JOIN app.catalogue_item i ON i.id = b.item_id GROUP BY i.service ORDER BY i.service`,
      ),
      count(
        `SELECT status AS label, count(*)::int AS count FROM app.booking GROUP BY status ORDER BY status`,
      ),
      this.pool.query<{ paise: number }>(
        `SELECT (coalesce((SELECT sum(commission_paise) FROM app.booking WHERE status = 'completed'), 0)
               + coalesce((SELECT sum(paid_paise - refunded_paise) FROM app.plan_purchase), 0))::int AS paise`,
      ),
    ]);
    const total = byStatus.reduce((sum, row) => sum + row.count, 0);
    const share = (statuses: string[]) =>
      total === 0
        ? 0
        : byStatus
            .filter((row) => statuses.includes(row.label))
            .reduce((sum, row) => sum + row.count, 0) / total;
    return {
      signUps: signUps.rows[0]?.n ?? 0,
      providersByRole: byRole,
      providersByDistrict: byDistrict,
      bookingsByService: byService,
      bookingsByStatus: byStatus,
      completionRate: Math.round(share(['completed']) * 1000) / 10,
      cancellationRate: Math.round(share(['cancelled', 'refunded']) * 1000) / 10,
      revenuePaise: revenue.rows[0]?.paise ?? 0,
    };
  }

  @Get('security')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin')
  @ApiOkResponse({ type: SecurityDto })
  async security(): Promise<SecurityDto> {
    const [grants, counts] = await Promise.all([
      this.pool.query<SecurityDto['breakGlass'][number]>(
        `SELECT admin_role AS "adminRole", reason, granted_at AS "grantedAt", expires_at AS "expiresAt"
           FROM app.access_grant ORDER BY granted_at DESC LIMIT 100`,
      ),
      this.pool.query<Omit<SecurityDto, 'breakGlass'>>(
        `SELECT (SELECT count(*)::int FROM app.ticket WHERE kind = 'strike_review' AND status <> 'resolved') AS "openStrikeReviews",
                (SELECT count(*)::int FROM app.referral WHERE status = 'flagged') AS "flaggedReferrals",
                (SELECT count(*)::int FROM app.stored_object WHERE scan_status = 'infected') AS "infectedUploads",
                (SELECT count(*)::int FROM app.record_access WHERE created_at > now() - interval '24 hours') AS "recordReads24h"`,
      ),
    ]);
    const totals = counts.rows[0] ?? {
      openStrikeReviews: 0,
      flaggedReferrals: 0,
      infectedUploads: 0,
      recordReads24h: 0,
    };
    const [failures, unusual] = await this.redis.mget(
      dayKey('authz-fail'),
      dayKey('unusual-readers'),
    );
    return {
      breakGlass: grants.rows,
      ...totals,
      authzFailuresToday: Number(failures ?? 0),
      unusualReadersToday: Number(unusual ?? 0),
      adminAccess: await this.adminAccess(),
    };
  }

  /** Admins oldest sign-in first; an active admin silent for 90 days is flagged (AD-17). */
  private async adminAccess(): Promise<SecurityDto['adminAccess']> {
    const { rows } = await this.pool.query<SecurityDto['adminAccess'][number]>(
      `SELECT email, role, status, last_sign_in_at AS "lastSignInAt",
              status = 'active' AND (last_sign_in_at IS NULL OR last_sign_in_at < now() - interval '90 days') AS stale
         FROM app.admin_account ORDER BY last_sign_in_at NULLS FIRST LIMIT 200`,
    );
    return rows;
  }
}
