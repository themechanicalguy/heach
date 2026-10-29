import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenDto } from '../auth/auth.dto.js';
import { bearerToken, principalOf } from '../auth/auth.guard.js';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { USER_REALM } from '../auth/session-realm.js';
import { GRANTED_USER_ROLES, NEW_ACCOUNT, USER_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { AddRoleDto, ConsentsDto, LocaleDto, MeDto, SetupPatchDto } from './accounts.dto.js';
import { AccountsService } from './accounts.service.js';

/**
 * The signed-in account: always the caller's own, from the session, never an ID in the request
 * (SE-02). Setup routes answer only while setup is unfinished (role `new_account`).
 */
@ApiTags('account')
@ApiBearerAuth()
@Controller('v1/me')
@UseGuards(requireFlag('accounts'))
export class MeController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...USER_ROLES)
  @ApiOkResponse({ type: MeDto })
  async me(@Req() request: Request): Promise<MeDto> {
    return this.accounts.view(principalOf(request));
  }

  /** Saves part of setup, so it can be resumed on any device (PO-03). */
  @Put('setup')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(NEW_ACCOUNT)
  @ApiNoContentResponse()
  async saveSetup(@Body() body: SetupPatchDto, @Req() request: Request): Promise<void> {
    await this.accounts.saveSetup(principalOf(request), body);
  }

  @Post('setup/complete')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles(NEW_ACCOUNT)
  @ApiOkResponse({ type: AccessTokenDto, description: 'An access token for the granted role' })
  async completeSetup(@Body() body: ConsentsDto, @Req() request: Request): Promise<AccessTokenDto> {
    const token = await this.accounts.completeSetup(
      principalOf(request),
      bearerToken(request) ?? '',
      body.consents,
    );
    return { accessToken: token, expiresIn: USER_REALM.accessTtlSeconds };
  }

  /** AC-02: the language can change at any time; it is also the language of SMS. */
  @Put('locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...USER_ROLES)
  @ApiNoContentResponse()
  async setLocale(@Body() body: LocaleDto, @Req() request: Request): Promise<void> {
    await this.accounts.setLocale(principalOf(request), body.locale);
  }

  /** A newer consent text, accepted at the next visit (PR-01). */
  @Post('consents')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @ApiNoContentResponse()
  async acceptConsents(@Body() body: ConsentsDto, @Req() request: Request): Promise<void> {
    await this.accounts.acceptConsents(principalOf(request), body.consents);
  }

  /** Adds the other side of the account; needs a fresh OTP (AC-05, decision L-11). */
  @Post('roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async addRole(@Body() body: AddRoleDto, @Req() request: Request): Promise<void> {
    await this.accounts.addRole(principalOf(request), body);
  }
}
