import {
  Body,
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
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { StoredFileDto } from '../onboarding/onboarding.dto.js';
import { ProviderAccess } from '../onboarding/provider-access.js';
import { ProfileQueryDto } from '../search/search.dto.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { actorOf } from './booking-actor.js';
import { BookingEffects } from './booking-effects.js';
import { BookingRepository } from './booking.repository.js';
import { BookingViews } from './booking-views.js';
import {
  BookingSummaryDto,
  CancelDto,
  DeclineDto,
  ProviderBookingDto,
  ProviderRequestDto,
} from './bookings.dto.js';
import { CancellationService } from './cancellation.service.js';
import { DispatchRepository } from './dispatch.repository.js';
import { DispatchService } from './dispatch.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** An Approved provider's requests and bookings (BK-03, BK-07, HS-01, A10, A14). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider')
@UseGuards(requireFlag('accounts'))
export class ProviderBookingsController {
  constructor(
    private readonly views: BookingViews,
    private readonly dispatch: DispatchService,
    private readonly offers: DispatchRepository,
    private readonly bookings: BookingRepository,
    private readonly cancellation: CancellationService,
    private readonly effects: BookingEffects,
    private readonly uploads: UploadsService,
    private readonly access: ProviderAccess,
  ) {}

  @Get('requests')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: [ProviderRequestDto] })
  async requests(
    @Query() query: ProfileQueryDto,
    @Req() request: Request,
  ): Promise<ProviderRequestDto[]> {
    const providerId = principalOf(request).userId;
    await this.access.approvedRole(providerId);
    return this.views.requests(providerId, query.locale ?? 'or');
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async accept(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    const principal = principalOf(request);
    await this.access.approvedRole(principal.userId);
    await this.dispatch.accept(principal, id);
  }

  @Post('requests/:id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async decline(
    @Param('id', uuid) id: string,
    @Body() body: DeclineDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.dispatch.decline(principalOf(request), id, body.reason);
  }

  /** The attached prescription, for an open offer or the provider's own booking (A14). */
  @Get('requests/:id/prescription')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: StoredFileDto })
  async prescription(
    @Param('id', uuid) id: string,
    @Req() request: Request,
  ): Promise<StoredFileDto> {
    const providerId = principalOf(request).userId;
    const booking = await this.bookings.find(id);
    const offered = (await this.offers.offers(undefined, id)).some(
      (offer) => offer.providerId === providerId && offer.status === 'offered',
    );
    const mine = booking?.providerId === providerId;
    const file =
      booking?.prescriptionObjectId && (offered || mine)
        ? await this.uploads.read(booking.prescriptionObjectId)
        : undefined;
    if (!file) throw new NotFoundException();
    return file;
  }

  @Get('bookings')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: [BookingSummaryDto] })
  async list(
    @Query() query: ProfileQueryDto,
    @Req() request: Request,
  ): Promise<BookingSummaryDto[]> {
    return this.views.listForProvider(principalOf(request).userId, query.locale ?? 'or');
  }

  @Get('bookings/:id')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ProviderBookingDto })
  async view(
    @Param('id', uuid) id: string,
    @Query() query: ProfileQueryDto,
    @Req() request: Request,
  ): Promise<ProviderBookingDto> {
    return this.views.forProvider(principalOf(request).userId, id, query.locale ?? 'or');
  }

  /** A provider cancelling a confirmed booking refunds the patient in full (BK-04, A12). */
  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async cancel(
    @Param('id', uuid) id: string,
    @Body() body: CancelDto,
    @Req() request: Request,
  ): Promise<void> {
    const principal = principalOf(request);
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, id);
      if (booking?.providerId !== principal.userId) throw new NotFoundException();
      return this.cancellation.cancel(client, booking, actorOf(principal), body.reason);
    });
    await this.effects.run(effects);
  }
}
