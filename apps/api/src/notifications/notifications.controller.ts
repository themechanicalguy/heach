import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
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
import { NotificationDto, NotificationQueryDto } from '../bookings/bookings.dto.js';

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
  async list(
    @Req() request: Request,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationDto[]> {
    const { rows } = await this.pool.query<NotificationDto>(
      `SELECT n.id, n.template, n.params, n.booking_id AS "bookingId", n.created_at AS "createdAt",
              n.read_at AS "readAt", o.text AS override
         FROM app.notification n
         LEFT JOIN app.message_override o ON o.template = n.template AND o.locale = $2
        WHERE n.account_id = $1 ORDER BY n.created_at DESC LIMIT 50`,
      [principalOf(request).userId, query.locale ?? 'or'],
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
