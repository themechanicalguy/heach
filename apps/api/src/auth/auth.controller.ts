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
import { ROLES } from '../common/request-context.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './access-token.store.js';
import { AccessTokenDto, LogoutDto, TestLoginDto } from './auth.dto.js';
import { bearerToken, principalOf } from './auth.guard.js';
import { Public, Roles } from './roles.decorator.js';
import { type IssuedTokens, SessionService } from './session.service.js';

export const REFRESH_COOKIE = 'heach_refresh';
const COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  /** Test identity adapter only; the module is not loaded outside dev and test (SE-07.4). */
  @Post('test-login')
  @HttpCode(HttpStatus.OK)
  @Public('Sign-in endpoint')
  @ApiOkResponse({ type: AccessTokenDto })
  async testLogin(
    @Body() body: TestLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    return respond(response, await this.sessions.signIn(body.userId));
  }

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
      return respond(response, await this.sessions.refresh(readCookie(request, REFRESH_COOKIE)));
    } catch (error) {
      // Only 401 means the session is over; on any other failure the cookie stays (SE-07.16).
      if (error instanceof UnauthorizedException) {
        response.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ROLES)
  @ApiNoContentResponse()
  async logout(
    @Body() body: LogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.signOut(principalOf(request), bearerToken(request) ?? '', body.allDevices);
    response.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }
}

/** Refresh token only in a Secure, HttpOnly, SameSite=Strict cookie (SE-07.1). */
function respond(response: Response, tokens: IssuedTokens): AccessTokenDto {
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
  });
  response.setHeader('Cache-Control', 'no-store');
  return { accessToken: tokens.accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}
