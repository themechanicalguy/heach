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
import { Roles } from '../auth/roles.decorator.js';
import { CARE_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { AdminReferralDto, JoinDto, ReferralDto, ReferralQueryDto } from './referrals.dto.js';
import { ReferralsService } from './referrals.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** The account's referral code, invitees and coupons (RR-01, RR-07, RR-08). */
@ApiTags('referrals')
@ApiBearerAuth()
@Controller('v1/me/referral')
@UseGuards(requireFlag('accounts'))
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: ReferralDto })
  async mine(@Req() request: Request): Promise<ReferralDto> {
    return this.referrals.mine(principalOf(request).userId);
  }

  @Post('join')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async join(@Body() body: JoinDto, @Req() request: Request): Promise<void> {
    await this.referrals.join(principalOf(request).userId, body.code);
  }
}

/** Referral review and coupon control (AD-16). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1')
@UseGuards(requireFlag('accounts'))
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('referrals')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [AdminReferralDto] })
  async queue(@Query() query: ReferralQueryDto): Promise<AdminReferralDto[]> {
    return this.referrals.queue(query.status);
  }

  @Post('referrals/:id/release')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async release(@Param('id', uuid) id: string): Promise<void> {
    await this.referrals.review(id, 'release');
  }

  @Post('referrals/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async reject(@Param('id', uuid) id: string): Promise<void> {
    await this.referrals.review(id, 'reject');
  }

  @Post('coupons/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async cancelCoupon(@Param('id', uuid) id: string): Promise<void> {
    await this.referrals.cancelCoupon(id);
  }
}
