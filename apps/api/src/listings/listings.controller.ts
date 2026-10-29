import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CatalogueRepository } from '../catalogue/catalogue.repository.js';
import { serviceOf } from '../catalogue/services.js';
import { reason } from '../common/error-response.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { ProviderAccess } from '../onboarding/provider-access.js';
import { ListingInputDto, ProviderListingsDto, ServiceAreaDto } from './listings.dto.js';
import { ListingsRepository } from './listings.repository.js';

const ENTITY = 'listing';

/**
 * An Approved provider's listings from the catalogue of their own service, and their service
 * area (SL-02 to SL-07). Attendants only see attendant items, which are never clinical.
 */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider')
@UseGuards(requireFlag('accounts'))
export class ListingsController {
  constructor(
    private readonly listings: ListingsRepository,
    private readonly catalogue: CatalogueRepository,
    private readonly access: ProviderAccess,
    private readonly audit: AuditService,
  ) {}

  @Get('listings')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ProviderListingsDto })
  async view(@Req() request: Request): Promise<ProviderListingsDto> {
    const providerId = principalOf(request).userId;
    const role = await this.access.approvedRole(providerId);
    const service = serviceOf(role);
    const [items, listed, pins, travelSurchargePaise, allPins] = await Promise.all([
      service ? this.catalogue.items('en', { service, activeOnly: true }) : Promise.resolve([]),
      this.listings.byItemCode(providerId),
      this.listings.pins(providerId),
      this.listings.surcharge(providerId),
      this.catalogue.pins(),
    ]);
    return {
      role,
      items: items.map((item) => ({
        code: item.code,
        name: item.name,
        kind: item.kind,
        prescriptionRequired: item.prescriptionRequired,
        defaultDurationMinutes: item.durationMinutes,
        listing: listed.get(item.code) ?? null,
      })),
      pins,
      travelSurchargePaise,
      serviceablePins: allPins.filter((pin) => pin.serviceable),
    };
  }

  @Put('listings/:code')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ProviderListingsDto })
  async save(
    @Param('code') code: string,
    @Body() body: ListingInputDto,
    @Req() request: Request,
  ): Promise<ProviderListingsDto> {
    const providerId = principalOf(request).userId;
    const role = await this.access.approvedRole(providerId);
    const item = await this.catalogue.item(code);
    if (!item?.active || item.service !== serviceOf(role)) throw new NotFoundException();
    await this.listings.transaction(async (client) => {
      const id = await this.listings.save(client, providerId, item.id, body);
      await this.audit.record({ action: `${ENTITY}.saved`, entity: ENTITY, entityId: id }, client);
    });
    return this.view(request);
  }

  @Put('service-area')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ProviderListingsDto })
  async area(@Body() body: ServiceAreaDto, @Req() request: Request): Promise<ProviderListingsDto> {
    const providerId = principalOf(request).userId;
    await this.access.approvedRole(providerId);
    await this.listings.transaction(async (client) => {
      if (
        !(await this.listings.replaceArea(client, providerId, body.pins, body.travelSurchargePaise))
      ) {
        throw reason(BadRequestException, 'pin_not_serviceable');
      }
      await this.audit.record(
        { action: 'service_area.saved', entity: 'service_area', entityId: providerId },
        client,
      );
    });
    return this.view(request);
  }
}
