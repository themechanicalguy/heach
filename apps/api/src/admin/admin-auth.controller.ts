import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AccessTokenDto, LogoutDto } from '../auth/auth.dto.js';
import { bearerToken, principalOf } from '../auth/auth.guard.js';
import { ADMIN_SESSIONS } from '../auth/auth.module.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { ADMIN_REALM } from '../auth/session-realm.js';
import { clearRefreshCookie, sendTokens } from '../auth/session-cookie.js';
import type { SessionService } from '../auth/session.service.js';
import { readCookie } from '../common/cookies.js';
import { ADMIN_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import {
  AdminCodeDto,
  AdminMeDto,
  AdminMfaDto,
  AdminPasswordAcceptedDto,
  AdminPasswordDto,
} from './admin.dto.js';
import { AdminAuthService } from './admin-auth.service.js';

/**
 * Admin sign-in with mandatory TOTP and short sessions (AD-01, SE-04; decision L-9). Its refresh
 * cookie is the admin realm's own, on its own path; patient and provider tokens are refused here.
 */
@ApiTags('admin')
@Controller('admin/v1')
@UseGuards(requireFlag('accounts'))
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    @Inject(ADMIN_SESSIONS) private readonly sessions: SessionService,
  ) {}

  @Post('auth/password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Public('First admin sign-in factor; throttled by address and locked after failures')
  @ApiOkResponse({ type: AdminPasswordAcceptedDto })
  async password(@Body() body: AdminPasswordDto): Promise<AdminPasswordAcceptedDto> {
    return this.auth.checkPassword(body.email, body.password);
  }

  @Post('auth/mfa')
  @HttpCode(HttpStatus.OK)
  @Public('Second admin sign-in factor, after the password')
  @ApiOkResponse({ type: AccessTokenDto })
  async mfa(
    @Body() body: AdminMfaDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    return sendTokens(response, ADMIN_REALM, await this.auth.checkCode(body.mfaTicket, body.code));
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @Public('Authenticated by the admin refresh cookie')
  @ApiCookieAuth(ADMIN_REALM.cookieName)
  @ApiOkResponse({ type: AccessTokenDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    try {
      const tokens = await this.sessions.refresh(readCookie(request, ADMIN_REALM.cookieName));
      return sendTokens(response, ADMIN_REALM, tokens);
    } catch (error) {
      if (error instanceof UnauthorizedException) clearRefreshCookie(response, ADMIN_REALM);
      throw error;
    }
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async logout(
    @Body() body: LogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.signOut(principalOf(request), bearerToken(request) ?? '', body.allDevices);
    clearRefreshCookie(response, ADMIN_REALM);
  }

  /** A fresh TOTP code before a sensitive action (decision L-11). */
  @Post('auth/reverify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async reverify(@Body() body: AdminCodeDto, @Req() request: Request): Promise<void> {
    await this.auth.reverify(principalOf(request), body.code);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AdminMeDto })
  async me(@Req() request: Request): Promise<AdminMeDto> {
    return this.auth.profile(principalOf(request));
  }
}
