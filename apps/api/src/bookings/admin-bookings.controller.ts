import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { reason } from '../common/error-response.js';
import { requireFlag } from '../flags/flags.module.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { RefundsService } from '../payments/refunds.service.js';
import { actorOf } from './booking-actor.js';
import { BookingEffects } from './booking-effects.js';
import { BookingRepository } from './booking.repository.js';
import { BookingViews } from './booking-views.js';
import {
  AdminBookingQueryDto,
  BookingSummaryDto,
  CancelDto,
  ManualRefundDto,
  ReassignDto,
} from './bookings.dto.js';
import { CancellationService } from './cancellation.service.js';
import { DispatchRepository } from './dispatch.repository.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * The bookings console (AD-05): search, timeline, cancel, reassign and refund. Names are
 * masked and no address or notes are shown. Finance issues manual refunds (PY-02, AD-07).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/bookings')
@UseGuards(requireFlag('accounts'))
export class AdminBookingsController {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly views: BookingViews,
    private readonly cancellation: CancellationService,
    private readonly refunds: RefundsService,
    private readonly payments: PaymentsRepository,
    private readonly dispatch: DispatchRepository,
    private readonly effects: BookingEffects,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support', 'finance')
  @ApiOkResponse({ type: [BookingSummaryDto] })
  async list(@Query() query: AdminBookingQueryDto): Promise<BookingSummaryDto[]> {
    const rows = await this.bookings.search(query.status ? { status: query.status } : {});
    return Promise.all(rows.map((row) => this.views.forAdmin(row)));
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support', 'finance')
  @ApiOkResponse()
  async view(@Param('id', uuid) id: string) {
    const booking = await this.bookings.find(id);
    if (!booking) throw new NotFoundException();
    const [summary, events, refunds, payments] = await Promise.all([
      this.views.forAdmin(booking),
      this.bookings.events(id),
      this.payments.refunds(id),
      this.payments.forBooking(id),
    ]);
    await this.audit.record({ action: 'booking.admin_read', entity: 'booking', entityId: id });
    return {
      ...summary,
      events,
      refunds: refunds.map(({ amountPaise, reason: why, status }) => ({
        amountPaise,
        reason: why,
        status,
      })),
      payments: payments.map(({ purpose, amountPaise, status }) => ({
        purpose,
        amountPaise,
        status,
      })),
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async cancel(
    @Param('id', uuid) id: string,
    @Body() body: CancelDto,
    @Req() request: Request,
  ): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, id);
      if (!booking) throw new NotFoundException();
      return this.cancellation.cancel(client, booking, actorOf(principalOf(request)), body.reason);
    });
    await this.effects.run(effects);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'finance')
  @ApiNoContentResponse()
  async refund(
    @Param('id', uuid) id: string,
    @Body() body: ManualRefundDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.bookings.transaction(async (client) => {
      if (!(await this.bookings.lock(client, id))) throw new NotFoundException();
      await this.refunds.plan(client, {
        bookingId: id,
        amountPaise: body.amountPaise,
        reason: body.reason,
        actorRole: principalOf(request).role,
      });
    });
    await this.effects.settleRefunds(id);
  }

  @Post(':id/reassign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async reassign(
    @Param('id', uuid) id: string,
    @Body() body: ReassignDto,
    @Req() request: Request,
  ): Promise<void> {
    const principal = principalOf(request);
    await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, id);
      if (!booking) throw new NotFoundException();
      if (booking.status !== 'confirmed')
        throw reason(ConflictException, 'booking_transition_refused');
      const [listing] = await this.dispatch.eligible(
        { listingId: body.listingId, pin: booking.pin },
        client,
      );
      if (listing?.itemId !== booking.itemId)
        throw reason(BadRequestException, 'listing_not_eligible');
      if (
        await this.bookings.providerBusy(
          client,
          listing.providerId,
          { start: booking.startsAt, end: booking.endsAt },
          id,
        )
      ) {
        throw reason(ConflictException, 'provider_busy');
      }
      await this.bookings.reassign(
        client,
        booking,
        { providerId: listing.providerId, listingId: listing.listingId },
        { id: principal.userId, role: principal.role },
      );
      await this.audit.record(
        { action: 'booking.reassigned', entity: 'booking', entityId: id },
        client,
      );
    });
    const booking = await this.bookings.find(id);
    if (booking?.providerId) {
      await this.effects.run({
        messages: [
          {
            to: booking.providerId,
            template: 'booking_confirmed',
            params: { time: booking.startsAt.toISOString() },
            bookingId: id,
          },
        ],
        refundBookings: [],
        releaseHolds: [],
      });
    }
  }
}
