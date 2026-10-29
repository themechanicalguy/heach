import {
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
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { GRANTED_USER_ROLES, USER_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { InvitationDto } from './organisations.dto.js';
import { InvitationsService } from './invitations.service.js';

/** Staff invitations addressed to the caller's own number (owner decision O-1). */
@ApiTags('account')
@ApiBearerAuth()
@Controller('v1/me/invitations')
@UseGuards(requireFlag('accounts'))
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...USER_ROLES)
  @ApiOkResponse({ type: [InvitationDto] })
  async list(@Req() request: Request): Promise<InvitationDto[]> {
    return this.invitations.list(principalOf(request));
  }

  /**
   * For an account whose setup is done: adds the staff role, which needs a fresh OTP like any
   * added role (L-11). A new account accepts during setup instead.
   */
  @Post(':id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...GRANTED_USER_ROLES)
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async accept(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.invitations.accept(principalOf(request), id);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...USER_ROLES)
  @ApiNoContentResponse()
  async decline(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.invitations.decline(principalOf(request), id);
  }
}
