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
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  IdentityDetailsDto,
  IdentityDocumentDto,
  IdentityRedirectDto,
  IdentityStartDto,
  PayoutDetailsDto,
} from './onboarding.dto.js';
import { IdentityService } from './identity.service.js';
import { OnboardingService } from './onboarding.service.js';

/** The signed-in provider's own application (J1, PO-01 to PO-06). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/application')
@UseGuards(requireFlag('accounts'))
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly identity: IdentityService,
  ) {}

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
  @ApiServiceUnavailableResponse({ description: 'identity_unavailable' })
  async startIdentity(
    @Body() body: IdentityStartDto,
    @Req() request: Request,
  ): Promise<IdentityRedirectDto> {
    return this.identity.start(principalOf(request), body);
  }

  @Post('identity/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ApplicationDto })
  async completeIdentity(
    @Body() body: IdentityCompleteDto,
    @Req() request: Request,
  ): Promise<ApplicationDto> {
    await this.identity.complete(principalOf(request), body);
    return this.onboarding.application(principalOf(request));
  }

  /** Date of birth and address as verified, for the provider only (KY-03). */
  @Get('identity/details')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: IdentityDetailsDto })
  async identityDetails(@Req() request: Request): Promise<IdentityDetailsDto> {
    return this.identity.details(principalOf(request));
  }

  /** The fallback when Aadhaar or DigiLocker cannot be used (KY-07); upload content type. */
  @Put('identity/document')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: ApplicationDto })
  async identityDocument(
    @Body() body: IdentityDocumentDto,
    @Req() request: Request,
  ): Promise<ApplicationDto> {
    await this.identity.uploadDocument(principalOf(request), body);
    return this.onboarding.application(principalOf(request));
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
