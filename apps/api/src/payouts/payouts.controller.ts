import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type pg from 'pg';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { Settings } from '../settings/settings.service.js';
import { LedgerService, nextPayoutRun } from './ledger.service.js';
import { EarningsDto, FinanceDto, PayoutRunDto } from './payouts.dto.js';

/** A provider's earnings ledger and payout status (PY-04, PY-05). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/earnings')
@UseGuards(requireFlag('accounts'))
export class EarningsController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: EarningsDto })
  async view(@Req() request: Request): Promise<EarningsDto> {
    const lines = await this.ledger.lines(principalOf(request).userId);
    const now = new Date();
    const open = lines.filter((line) => !line.paidOut);
    return {
      balancePaise: open.reduce((sum, line) => sum + line.amountPaise, 0),
      heldPaise: open
        .filter((line) => line.availableAt > now)
        .reduce((sum, line) => sum + line.amountPaise, 0),
      paidOutPaise: -lines
        .filter((line) => line.kind === 'payout')
        .reduce((sum, line) => sum + line.amountPaise, 0),
      nextPayoutAt: nextPayoutRun(now),
      lines,
    };
  }
}

/** Finance (AD-07): totals, commission setting, payout runs and a CSV export without Restricted data. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/finance')
@UseGuards(requireFlag('accounts'))
export class FinanceController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly settings: Settings,
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'finance')
  @ApiOkResponse({ type: FinanceDto })
  async view(): Promise<FinanceDto> {
    const { rows } = await this.pool.query<{ paid: number; refunded: number; commission: number }>(
      `SELECT coalesce(sum(paid_paise), 0)::int AS paid, coalesce(sum(refunded_paise), 0)::int AS refunded,
              coalesce(sum(commission_paise) FILTER (WHERE status = 'completed'), 0)::int AS commission
         FROM app.booking`,
    );
    const totals = rows[0];
    return {
      paidPaise: totals?.paid ?? 0,
      refundedPaise: totals?.refunded ?? 0,
      commissionPaise: totals?.commission ?? 0,
      commissionBps: await this.settings.get('commission_bps'),
      runs: await this.ledger.runs(),
    };
  }

  @Post('payout-runs')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'finance')
  @ApiOkResponse({ type: PayoutRunDto })
  async run(): Promise<PayoutRunDto> {
    const result = await this.ledger.runPayouts(new Date());
    return {
      id: result.runId,
      runAt: new Date(),
      providerCount: result.providers,
      totalPaise: result.totalPaise,
    };
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="bookings.csv"')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'finance')
  @ApiOkResponse({ type: String })
  async export(): Promise<string> {
    const { rows } = await this.pool.query<Record<string, string | number | Date>>(
      `SELECT b.id, b.status, i.code AS item, b.created_at::date AS created, b.total_paise, b.paid_paise,
              b.refunded_paise, b.commission_paise
         FROM app.booking b JOIN app.catalogue_item i ON i.id = b.item_id ORDER BY b.created_at DESC LIMIT 5000`,
    );
    const header =
      'booking_id,status,item,created,total_paise,paid_paise,refunded_paise,commission_paise';
    return [
      header,
      ...rows.map((row) =>
        Object.values(row)
          .map((value) =>
            value instanceof Date ? value.toISOString().slice(0, 10) : String(value),
          )
          .join(','),
      ),
    ].join('\n');
  }
}
