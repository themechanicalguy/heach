import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import {
  DocumentUploadDto,
  ProviderProfileInputDto,
  UploadDto,
} from '../onboarding/onboarding.dto.js';
import { clientAddress } from '../otp/otp-origin.js';
import { AssistedActionsService } from './assisted-actions.service.js';
import {
  AssistedDetailsDto,
  AssistedIdentityDocumentDto,
  AssistedPayoutChallengeDto,
  AssistedPayoutDto,
  AssistedSessionDto,
} from './assisted-onboarding.dto.js';
import { AssistedPayoutService } from './assisted-payout.service.js';
import { assistedOrigin } from './assisted-rules.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * Assisted onboarding, part 2 (AD-12): what the admin enters for a consented provider. Uploads
 * use the upload content type (7 MB). Answers are the masked session view, never a stored value;
 * there is no route that reads a document, photo, identity document or payout back.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/assisted-onboarding/sessions/:sessionId')
@UseGuards(requireFlag('accounts'))
export class AssistedActionsController {
  constructor(
    private readonly actions: AssistedActionsService,
    private readonly payout: AssistedPayoutService,
  ) {}

  @Put('details')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  details(
    @Param('sessionId', uuid) sessionId: string,
    @Body() body: AssistedDetailsDto,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    return this.actions.saveDetails(principalOf(request), sessionId, body);
  }

  @Put('documents/:item')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  document(
    @Param('sessionId', uuid) sessionId: string,
    @Param('item') item: string,
    @Body() body: DocumentUploadDto,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    return this.actions.uploadDocument(principalOf(request), sessionId, item, body);
  }

  @Put('identity-document')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  identityDocument(
    @Param('sessionId', uuid) sessionId: string,
    @Body() body: AssistedIdentityDocumentDto,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    return this.actions.uploadIdentityDocument(principalOf(request), sessionId, body);
  }

  @Put('profile')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  profile(
    @Param('sessionId', uuid) sessionId: string,
    @Body() body: ProviderProfileInputDto,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    return this.actions.saveProfile(principalOf(request), sessionId, body);
  }

  @Put('photo')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  photo(
    @Param('sessionId', uuid) sessionId: string,
    @Body() body: UploadDto,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    return this.actions.uploadPhoto(principalOf(request), sessionId, body);
  }

  @Post('payout/code')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedPayoutChallengeDto })
  payoutCode(
    @Param('sessionId', uuid) sessionId: string,
    @Req() request: Request,
  ): Promise<AssistedPayoutChallengeDto> {
    const admin = principalOf(request);
    return this.payout.requestCode(admin, sessionId, assistedOrigin(admin, request));
  }

  @Post('payout/code/resend')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedPayoutChallengeDto })
  resendPayoutCode(
    @Param('sessionId', uuid) sessionId: string,
    @Req() request: Request,
  ): Promise<AssistedPayoutChallengeDto> {
    const admin = principalOf(request);
    return this.payout.resendCode(admin, sessionId, assistedOrigin(admin, request));
  }

  @Put('payout')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: AssistedSessionDto })
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async savePayout(
    @Param('sessionId', uuid) sessionId: string,
    @Body() body: AssistedPayoutDto,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    const admin = principalOf(request);
    await this.payout.save(admin, sessionId, body, clientAddress(request));
    return this.actions.view(admin, sessionId);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  submit(
    @Param('sessionId', uuid) sessionId: string,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    return this.actions.submit(principalOf(request), sessionId);
  }
}
