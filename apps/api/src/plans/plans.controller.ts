import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
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
import { Public, Roles } from '../auth/roles.decorator.js';
import { CARE_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { ProviderAccess } from '../onboarding/provider-access.js';
import { ProfileQueryDto } from '../search/search.dto.js';
import {
  AdminPurchaseDto,
  AutoRenewDto,
  PlanDto,
  PlanInputDto,
  PlanQueryDto,
  PurchaseCheckoutDto,
  PurchaseDto,
} from './plans.dto.js';
import { PlansService } from './plans.service.js';
import { RenewalsService } from './renewals.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** Plan pages and purchases (J8; PK-01 to PK-07). */
@ApiTags('plans')
@Controller('v1')
@UseGuards(requireFlag('accounts'))
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly renewals: RenewalsService,
  ) {}

  @Get('plans')
  @Public('Plan pages are public so terms are read before buying (PK-03)')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ type: [PlanDto] })
  async list(@Query() query: PlanQueryDto): Promise<PlanDto[]> {
    return this.plans.list(
      { status: 'active', ...(query.service ? { service: query.service } : {}) },
      query.locale ?? 'or',
    );
  }

  @Get('plans/:id')
  @Public('Plan pages are public so terms are read before buying (PK-03)')
  @ApiOkResponse({ type: PlanDto })
  async one(@Param('id', uuid) id: string, @Query() query: ProfileQueryDto): Promise<PlanDto> {
    return this.plans.one(id, query.locale ?? 'or');
  }

  @Post('plans/:id/purchase')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...CARE_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PurchaseCheckoutDto })
  async purchase(
    @Param('id', uuid) id: string,
    @Req() request: Request,
  ): Promise<PurchaseCheckoutDto> {
    return this.plans.purchase(principalOf(request), id);
  }

  @Get('me/plans')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({ type: [PurchaseDto] })
  async mine(@Query() query: ProfileQueryDto, @Req() request: Request): Promise<PurchaseDto[]> {
    return this.plans.mine(principalOf(request).userId, query.locale ?? 'or');
  }

  @Post('me/plans/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async cancel(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.plans.cancel(principalOf(request), id);
  }

  /** Auto-renewal can be turned off at any time; the plan runs to the end of its period (PK-06). */
  @Post('me/plans/:id/auto-renew')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async autoRenew(
    @Param('id', uuid) id: string,
    @Body() body: AutoRenewDto,
    @Req() request: Request,
  ): Promise<void> {
    const buyerId = principalOf(request).userId;
    if (body.enabled) await this.renewals.enable(buyerId, id);
    else await this.renewals.disable(buyerId, id);
  }
}

/** A provider's own packages, approved by an admin before sale (PK-01). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/plans')
@UseGuards(requireFlag('accounts'))
export class ProviderPlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly access: ProviderAccess,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: [PlanDto] })
  async mine(@Query() query: ProfileQueryDto, @Req() request: Request): Promise<PlanDto[]> {
    return this.plans.list({ providerId: principalOf(request).userId }, query.locale ?? 'or');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse()
  async define(@Body() body: PlanInputDto, @Req() request: Request): Promise<{ id: string }> {
    const providerId = principalOf(request).userId;
    await this.access.approvedRole(providerId);
    return {
      id: await this.plans.define(body, providerId),
    };
  }
}

/** Plans for admins (AD-14): create, approve providers' packages, retire. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/plans')
@UseGuards(requireFlag('accounts'))
export class AdminPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support', 'finance')
  @ApiOkResponse({ type: [PlanDto] })
  async list(): Promise<PlanDto[]> {
    return this.plans.list({}, 'en');
  }

  /** Purchases, renewals and cancellations (AD-14), without who bought them. */
  @Get('purchases')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support', 'finance')
  @ApiOkResponse({ type: [AdminPurchaseDto] })
  async purchases(): Promise<AdminPurchaseDto[]> {
    return this.plans.purchases();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('super_admin')
  @ApiOkResponse()
  async define(@Body() body: PlanInputDto): Promise<{ id: string }> {
    return { id: await this.plans.define(body, null) };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @ApiNoContentResponse()
  async approve(@Param('id', uuid) id: string): Promise<void> {
    await this.plans.setStatus(id, 'active');
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @ApiNoContentResponse()
  async retire(@Param('id', uuid) id: string): Promise<void> {
    await this.plans.setStatus(id, 'retired');
  }
}
