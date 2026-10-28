import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { readCookie } from '../common/cookies.js';
import { USER_ROLES } from '../common/request-context.js';
import { AccessTokenDto, LogoutDto } from './auth.dto.js';
import { bearerToken, principalOf } from './auth.guard.js';
import { Public, Roles } from './roles.decorator.js';
import { USER_REALM } from './session-realm.js';
import { clearRefreshCookie, sendTokens } from './session-cookie.js';
import { SessionService } from './session.service.js';

export const REFRESH_COOKIE = USER_REALM.cookieName;

/** Session refresh and sign-out for patients and providers (SE-07). */
@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Public('Authenticated by the refresh cookie instead of an access token')
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: AccessTokenDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    try {
      const tokens = await this.sessions.refresh(readCookie(request, REFRESH_COOKIE));
      return sendTokens(response, USER_REALM, tokens);
    } catch (error) {
      // Only 401 means the session is over; on any other failure the cookie stays (SE-07.16).
      if (error instanceof UnauthorizedException) {
        clearRefreshCookie(response, USER_REALM);
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...USER_ROLES)
  @ApiNoContentResponse()
  async logout(
    @Body() body: LogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.signOut(principalOf(request), bearerToken(request) ?? '', body.allDevices);
    clearRefreshCookie(response, USER_REALM);
  }
}
