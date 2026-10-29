import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { CARE_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { ProfileQueryDto } from '../search/search.dto.js';
import { actorOf } from './booking-actor.js';
import { BookingEffects } from './booking-effects.js';
import { BookingRepository } from './booking.repository.js';
import { BookingViews } from './booking-views.js';
import {
  AnySlotsDto,
  AnySlotsQueryDto,
  BookingDto,
  BookingPolicyDto,
  BookingSummaryDto,
  CancelDto,
  CheckoutDto,
  CreateBookingDto,
} from './bookings.dto.js';
import { CancellationService } from './cancellation.service.js';
import { CheckoutService } from './checkout.service.js';
import { PaymentEventsService } from './payment-events.service.js';
import { Settings } from '../settings/settings.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** A patient's or representative's own bookings (J3, J4; BK-01 to BK-07). */
@ApiTags('bookings')
@ApiBearerAuth()
@Controller('v1/bookings')
@UseGuards(requireFlag('accounts'))
export class BookingsController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly views: BookingViews,
    private readonly bookings: BookingRepository,
    private readonly cancellation: CancellationService,
    private readonly effects: BookingEffects,
    private readonly paymentEvents: PaymentEventsService,
  ) {}

  /** JSON, or the upload content type when a prescription is attached (EN-07). */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: BookingDto })
  async create(@Body() body: CreateBookingDto, @Req() request: Request): Promise<BookingDto> {
    const principal = principalOf(request);
    const { bookingId, checkout } = await this.checkout.create(principal, body);
    if (!checkout) await this.paymentEvents.coveredWithoutPayment(bookingId);
    return this.views.forBooker(principal.userId, bookingId, body.locale ?? 'or');
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [BookingSummaryDto] })
  async list(
    @Query() query: ProfileQueryDto,
    @Req() request: Request,
  ): Promise<BookingSummaryDto[]> {
    return this.views.listForBooker(principalOf(request).userId, query.locale ?? 'or');
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: BookingDto })
  async view(
    @Param('id', uuid) id: string,
    @Query() query: ProfileQueryDto,
    @Req() request: Request,
  ): Promise<BookingDto> {
    return this.views.forBooker(principalOf(request).userId, id, query.locale ?? 'or');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: BookingDto })
  async cancel(
    @Param('id', uuid) id: string,
    @Body() body: CancelDto,
    @Req() request: Request,
  ): Promise<BookingDto> {
    const principal = principalOf(request);
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, id);
      if (booking?.bookerId !== principal.userId) throw new NotFoundException();
      return this.cancellation.cancel(client, booking, actorOf(principal), body.reason);
    });
    await this.effects.run(effects);
    return this.views.forBooker(principal.userId, id, 'or');
  }

  /** The balance of a shift booking, before the first shift (Q-ADVANCE). */
  @Post(':id/balance')
  @HttpCode(HttpStatus.OK)
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: CheckoutDto })
  async balance(@Param('id', uuid) id: string, @Req() request: Request): Promise<CheckoutDto> {
    await this.views.forBooker(principalOf(request).userId, id, 'en');
    return this.checkout.balanceCheckout(id);
  }
}

/** Free times of any available provider (amendment A10); public, like provider slots. */
@ApiTags('search')
@Controller('v1/search')
@UseGuards(requireFlag('accounts'))
export class AnySlotsController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get('any-slots')
  @Public('Open times are public so a patient can choose before signing in')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AnySlotsDto })
  async anySlots(@Query() query: AnySlotsQueryDto): Promise<AnySlotsDto> {
    return this.checkout.anySlots(query);
  }
}

/** The cancellation and payment policy, shown before a patient pays (BK-04). */
@ApiTags('bookings')
@Controller('v1/booking-policy')
@UseGuards(requireFlag('accounts'))
export class BookingPolicyController {
  constructor(private readonly settings: Settings) {}

  @Get()
  @Public('The policy is shown to everyone before payment (BK-04)')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ type: BookingPolicyDto })
  async policy(): Promise<BookingPolicyDto> {
    return {
      freeCancellationHours: await this.settings.get('free_cancellation_hours'),
      lateRefundPercent: await this.settings.get('late_cancellation_refund_percent'),
      attendantAdvancePercent: await this.settings.get('attendant_advance_percent'),
      acceptanceWindowMinutes: await this.settings.get('acceptance_window_minutes'),
      noShowWaitMinutes: await this.settings.get('no_show_wait_minutes'),
    };
  }
}
