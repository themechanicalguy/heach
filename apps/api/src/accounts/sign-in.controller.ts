import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AccessTokenDto } from '../auth/auth.dto.js';
import { bearerToken, principalOf } from '../auth/auth.guard.js';
import { ReverificationStore } from '../auth/reverification.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { USER_REALM } from '../auth/session-realm.js';
import { sendTokens } from '../auth/session-cookie.js';
import { USER_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { normaliseIndianMobile } from '../otp/mobile-number.js';
import { clientAddress as address, otpOrigin as origin } from '../otp/otp-origin.js';
import { OtpService } from '../otp/otp.service.js';
import {
  OtpChallengeDto,
  OtpRequestDto,
  OtpResendDto,
  OtpVerifyDto,
  ReverifyDto,
  SwitchRoleDto,
} from './accounts.dto.js';
import { AccountsService } from './accounts.service.js';

/**
 * OTP sign-up and sign-in for patients and providers (AC-01), role switching (decision L-3) and
 * OTP re-verification for sensitive actions (AC-05). Answers never say whether a number has an
 * account (generic errors, no enumeration).
 */
@ApiTags('auth')
@Controller('v1/auth')
@UseGuards(requireFlag('accounts'))
export class SignInController {
  constructor(
    private readonly otp: OtpService,
    private readonly accounts: AccountsService,
    private readonly reverifications: ReverificationStore,
  ) {}

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Public('Starts sign-in; throttled per number, device and address (SE-08)')
  @ApiOkResponse({ type: OtpChallengeDto })
  @ApiTooManyRequestsResponse()
  async requestCode(
    @Body() body: OtpRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OtpChallengeDto> {
    const mobile = normaliseIndianMobile(body.mobile);
    if (!mobile) {
      throw new BadRequestException({
        error: 'Bad Request',
        message: 'mobile_invalid',
        code: 'mobile_invalid',
      });
    }
    const target = { mobile, purpose: 'sign_in' as const, accountId: null, locale: body.locale };
    return this.otp.issue(target, origin(request, response));
  }

  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Public('Resends a sign-in code after the cooldown (SE-08)')
  @ApiOkResponse({ type: OtpChallengeDto })
  @ApiTooManyRequestsResponse()
  async resendCode(
    @Body() body: OtpResendDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OtpChallengeDto> {
    return this.otp.resend(body.challengeId, body.locale, origin(request, response));
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Public('Finishes sign-in with the code')
  @ApiOkResponse({ type: AccessTokenDto })
  async verifyCode(
    @Body() body: OtpVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    const verified = await this.otp.verify(
      body.challengeId,
      body.code,
      { purpose: 'sign_in' },
      address(request),
    );
    return sendTokens(response, USER_REALM, await this.accounts.signIn(verified, body.locale));
  }

  @Post('switch-role')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles(...USER_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AccessTokenDto })
  async switchRole(@Body() body: SwitchRoleDto, @Req() request: Request): Promise<AccessTokenDto> {
    const token = await this.accounts.switchRole(
      principalOf(request),
      bearerToken(request) ?? '',
      body.role,
    );
    return { accessToken: token, expiresIn: USER_REALM.accessTtlSeconds };
  }

  /** Sends a code to the account's own number; the browser never names the number. */
  @Post('reverify')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles(...USER_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({ type: OtpChallengeDto })
  @ApiTooManyRequestsResponse()
  async startReverification(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OtpChallengeDto> {
    return this.accounts.startReverification(principalOf(request), origin(request, response));
  }

  @Post('reverify/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...USER_ROLES)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async reverify(@Body() body: ReverifyDto, @Req() request: Request): Promise<void> {
    const principal = principalOf(request);
    await this.otp.verify(
      body.challengeId,
      body.code,
      { purpose: 'reverify', accountId: principal.userId },
      address(request),
    );
    await this.reverifications.mark(principal.sessionId);
  }
}
