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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { clientAddress } from '../otp/otp-origin.js';
import { AssistedConsentService } from './assisted-consent.service.js';
import {
  AssistedChallengeDto,
  AssistedCodeDto,
  AssistedConsentRequestDto,
  AssistedSessionDto,
} from './assisted-onboarding.dto.js';
import { assistedOrigin } from './assisted-rules.js';
import { AssistedSessions } from './assisted-sessions.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * Assisted onboarding, part 1 (AD-12): the provider's consent by SMS code, and the session it
 * opens. Support and super admins only; every route answers `no-store`.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/assisted-onboarding')
@UseGuards(requireFlag('accounts'))
export class AssistedSessionsController {
  constructor(
    private readonly consent: AssistedConsentService,
    private readonly sessions: AssistedSessions,
  ) {}

  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: AssistedChallengeDto })
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async request(
    @Body() body: AssistedConsentRequestDto,
    @Req() request: Request,
  ): Promise<AssistedChallengeDto> {
    const admin = principalOf(request);
    return this.consent.request(admin, body, assistedOrigin(admin, request));
  }

  @Post('sessions/:sessionId/consent/resend')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedChallengeDto })
  async resend(
    @Param('sessionId', uuid) sessionId: string,
    @Req() request: Request,
  ): Promise<AssistedChallengeDto> {
    const admin = principalOf(request);
    return this.consent.resend(admin, sessionId, assistedOrigin(admin, request));
  }

  @Post('sessions/:sessionId/consent/verify')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  async verify(
    @Param('sessionId', uuid) sessionId: string,
    @Body() body: AssistedCodeDto,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    return this.consent.verify(principalOf(request), sessionId, body.code, clientAddress(request));
  }

  // Declared before `:sessionId`, which would otherwise take "current" for an id.
  @Get('sessions/current')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  @ApiNotFoundResponse({ description: 'The admin has no running session' })
  async current(@Req() request: Request): Promise<AssistedSessionDto> {
    return this.sessions.current(principalOf(request));
  }

  @Get('sessions/:sessionId')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: AssistedSessionDto })
  async view(
    @Param('sessionId', uuid) sessionId: string,
    @Req() request: Request,
  ): Promise<AssistedSessionDto> {
    const session = await this.sessions.require(principalOf(request), sessionId);
    return this.sessions.view(session);
  }

  @Post('sessions/:sessionId/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async end(@Param('sessionId', uuid) sessionId: string, @Req() request: Request): Promise<void> {
    await this.sessions.end(principalOf(request), sessionId);
  }
}
