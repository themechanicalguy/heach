import { randomUUID } from 'node:crypto';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { principalOf } from '../auth/auth.guard.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { reason } from '../common/error-response.js';
import { CARE_ROLES } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { AdminReviewDto, HideDto, ReviewDto, ReviewInputDto } from './reviews.dto.js';

const uuid = new ParseUUIDPipe({ version: '4' });
const PUBLIC_COLUMNS = 'id, stars, comment, created_at AS "createdAt"';

/**
 * Ratings and reviews (RF-01, RF-02): the booker rates a completed booking once; reviews show on
 * the provider's profile without the patient's name; the provider reports one, an admin hides it
 * with a recorded reason.
 */
@ApiTags('reviews')
@Controller('v1')
@UseGuards(requireFlag('accounts'))
export class ReviewsController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    private readonly audit: AuditService,
  ) {}

  @Post('bookings/:id/review')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...CARE_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ReviewDto })
  async rate(
    @Param('id', uuid) id: string,
    @Body() body: ReviewInputDto,
    @Req() request: Request,
  ): Promise<ReviewDto> {
    const { rows } = await this.pool.query<{ provider_account_id: string; status: string }>(
      'SELECT provider_account_id, status FROM app.booking WHERE id = $1 AND booker_account_id = $2',
      [id, principalOf(request).userId],
    );
    const booking = rows[0];
    if (!booking) throw new NotFoundException();
    if (booking.status !== 'completed') throw reason(ConflictException, 'review_not_allowed');
    const created = await this.pool.query<ReviewDto>(
      `INSERT INTO app.review (id, booking_id, patient_account_id, provider_account_id, stars, comment)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (booking_id) DO NOTHING RETURNING ${PUBLIC_COLUMNS}`,
      [
        randomUUID(),
        id,
        principalOf(request).userId,
        booking.provider_account_id,
        body.stars,
        body.comment ?? null,
      ],
    );
    const review = created.rows[0];
    if (!review) throw reason(ConflictException, 'review_exists');
    await this.audit.record({ action: 'review.created', entity: 'review', entityId: review.id });
    return review;
  }

  @Get('providers/:id/reviews')
  @Public('Reviews are part of the public provider profile (RF-01, PO-05)')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ type: [ReviewDto] })
  async list(@Param('id', uuid) id: string): Promise<ReviewDto[]> {
    const { rows } = await this.pool.query<ReviewDto>(
      `SELECT ${PUBLIC_COLUMNS} FROM app.review WHERE provider_account_id = $1 AND NOT hidden ORDER BY created_at DESC LIMIT 20`,
      [id],
    );
    return rows;
  }

  @Post('provider/reviews/:id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async report(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    const result = await this.pool.query(
      'UPDATE app.review SET reported = true WHERE id = $1 AND provider_account_id = $2',
      [id, principalOf(request).userId],
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    await this.audit.record({ action: 'review.reported', entity: 'review', entityId: id });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/reviews')
@UseGuards(requireFlag('accounts'))
export class AdminReviewsController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [AdminReviewDto] })
  async reported(): Promise<AdminReviewDto[]> {
    const { rows } = await this.pool.query<AdminReviewDto>(
      `SELECT ${PUBLIC_COLUMNS}, provider_account_id AS "providerId", reported, hidden, hidden_reason AS "hiddenReason"
         FROM app.review WHERE reported ORDER BY created_at DESC LIMIT 200`,
    );
    return rows;
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async hide(@Param('id', uuid) id: string, @Body() body: HideDto): Promise<void> {
    const result = await this.pool.query(
      'UPDATE app.review SET hidden = true, hidden_reason = $2 WHERE id = $1',
      [id, body.reason],
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    await this.audit.record({ action: 'review.hidden', entity: 'review', entityId: id });
  }
}
