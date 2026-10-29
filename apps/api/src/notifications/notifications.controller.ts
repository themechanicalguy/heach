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
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type pg from 'pg';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { GRANTED_USER_ROLES } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { requireFlag } from '../flags/flags.module.js';
import { NotificationDto } from '../bookings/bookings.dto.js';

/** The in-app notification centre (NT-02): the account's own messages, newest first. */
@ApiTags('account')
@ApiBearerAuth()
@Controller('v1/me/notifications')
@UseGuards(requireFlag('accounts'))
export class NotificationsController {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...GRANTED_USER_ROLES)
  @ApiOkResponse({ type: [NotificationDto] })
  async list(@Req() request: Request): Promise<NotificationDto[]> {
    const { rows } = await this.pool.query<NotificationDto>(
      `SELECT id, template, params, booking_id AS "bookingId", created_at AS "createdAt", read_at AS "readAt"
         FROM app.notification WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [principalOf(request).userId],
    );
    return rows;
  }

  @Post('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @ApiNoContentResponse()
  async read(@Req() request: Request): Promise<void> {
    await this.pool.query(
      'UPDATE app.notification SET read_at = now() WHERE account_id = $1 AND read_at IS NULL',
      [principalOf(request).userId],
    );
  }
}
