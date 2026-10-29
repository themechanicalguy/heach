import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccessTokenDto, TestLoginDto } from '../auth/auth.dto.js';
import { Public } from '../auth/roles.decorator.js';
import { USER_REALM } from '../auth/session-realm.js';
import { sendTokens } from '../auth/session-cookie.js';
import { TEST_LOGIN_KEY_HEADER } from '../auth/test-identity.adapter.js';
import { TestLoginGate } from '../auth/test-login.gate.js';
import { AccountsService } from './accounts.service.js';

/**
 * Test identity adapter only; the API does not start outside local, test and dev (SE-07.4). On the
 * dev host it answers only requests carrying the key of the loopback-only entry (SE-07.23); any
 * other request gets the same 404 as a route that does not exist. Only synthetic accounts can
 * sign in here, never an account created by OTP (decision L-1).
 */
@ApiTags('auth')
@Controller('v1/auth')
export class TestLoginController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('test-login')
  @HttpCode(HttpStatus.OK)
  @Public('Sign-in endpoint')
  @UseGuards(TestLoginGate)
  @ApiHeader({ name: TEST_LOGIN_KEY_HEADER, required: false, description: 'Required in dev' })
  @ApiOkResponse({ type: AccessTokenDto })
  async testLogin(
    @Body() body: TestLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    const tokens = await this.accounts.signInSynthetic(body.userId);
    if (!tokens) throw new NotFoundException();
    return sendTokens(response, USER_REALM, tokens);
  }
}
