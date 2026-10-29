import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from './checklists.js';
import {
  ApplicationDto,
  DocumentUploadDto,
  IdentityCompleteDto,
  IdentityRedirectDto,
  IdentityStartDto,
  PayoutDetailsDto,
} from './onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

/** The signed-in provider's own application (J1, PO-01 to PO-06). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/application')
@UseGuards(requireFlag('accounts'))
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ApplicationDto })
  async view(@Req() request: Request): Promise<ApplicationDto> {
    return this.onboarding.application(principalOf(request));
  }

  /** Sent with the content type `application/vnd.heach.upload+json`, which allows 7 MB. */
  @Put('documents/:item')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ApplicationDto })
  async upload(
    @Param('item') item: string,
    @Body() body: DocumentUploadDto,
    @Req() request: Request,
  ): Promise<ApplicationDto> {
    return this.onboarding.upload(principalOf(request), item, body);
  }

  @Post('identity/start')
  @HttpCode(HttpStatus.OK)
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: IdentityRedirectDto })
  async startIdentity(
    @Body() body: IdentityStartDto,
    @Req() request: Request,
  ): Promise<IdentityRedirectDto> {
    return this.onboarding.startIdentity(principalOf(request), body.locale);
  }

  @Post('identity/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ApplicationDto })
  async completeIdentity(
    @Body() body: IdentityCompleteDto,
    @Req() request: Request,
  ): Promise<ApplicationDto> {
    return this.onboarding.completeIdentity(principalOf(request), body);
  }

  @Put('payout')
  @Roles(...ONBOARDING_ROLES)
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: ApplicationDto })
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async payout(@Body() body: PayoutDetailsDto, @Req() request: Request): Promise<ApplicationDto> {
    return this.onboarding.savePayout(principalOf(request), body);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ApplicationDto })
  async submit(@Req() request: Request): Promise<ApplicationDto> {
    return this.onboarding.submit(principalOf(request));
  }
}
