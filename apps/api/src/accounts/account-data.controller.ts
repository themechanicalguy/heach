import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { GRANTED_USER_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { clientAddress, otpOrigin } from '../otp/otp-origin.js';
import { AccountDataService } from './account-data.service.js';
import {
  AccountExportDto,
  MobileChangeDto,
  OtpChallengeDto,
  ProfileCorrectionDto,
  ReverifyDto,
} from './accounts.dto.js';
import { MobileChangeService } from './mobile-change.service.js';

/**
 * The account holder's own data after setup (AC-06, PR-04) and number change (O-3). Always the
 * caller's account, from the session; sensitive actions need a fresh OTP (AC-05, L-11).
 */
@ApiTags('account')
@ApiBearerAuth()
@Controller('v1/me')
@UseGuards(requireFlag('accounts'))
export class AccountDataController {
  constructor(
    private readonly data: AccountDataService,
    private readonly mobileChange: MobileChangeService,
  ) {}

  @Put('profile')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @ApiNoContentResponse()
  async correctProfile(@Body() body: ProfileCorrectionDto, @Req() request: Request) {
    await this.data.correctProfile(principalOf(request), body);
  }

  @Get('export')
  @Header('Cache-Control', 'no-store')
  @Roles(...GRANTED_USER_ROLES)
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: AccountExportDto })
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async exportData(@Req() request: Request): Promise<AccountExportDto> {
    return this.data.exportData(principalOf(request));
  }

  @Post('deletion-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async requestDeletion(@Req() request: Request): Promise<void> {
    await this.data.requestDeletion(principalOf(request));
  }

  @Delete('deletion-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @ApiNoContentResponse()
  async cancelDeletion(@Req() request: Request): Promise<void> {
    await this.data.cancelDeletion(principalOf(request));
  }

  /** Sends a code to the new number; needs a fresh OTP on the current one first (O-3). */
  @Post('mobile')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles(...GRANTED_USER_ROLES)
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: OtpChallengeDto })
  @ApiForbiddenResponse({ description: 'reverification_required' })
  @ApiTooManyRequestsResponse()
  async startMobileChange(
    @Body() body: MobileChangeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OtpChallengeDto> {
    return this.mobileChange.start(principalOf(request), body.mobile, otpOrigin(request, response));
  }

  @Post('mobile/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @ApiNoContentResponse()
  async verifyMobileChange(@Body() body: ReverifyDto, @Req() request: Request): Promise<void> {
    const principal = principalOf(request);
    await this.mobileChange.verify(principal, body.challengeId, body.code, clientAddress(request));
  }
}
