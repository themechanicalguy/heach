import {
  Body,
  Controller,
  Delete,
  Get,
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
import { requireFlag } from '../flags/flags.module.js';
import { InviteDto, OrganisationDto, OrganisationNameDto } from './organisations.dto.js';
import { OrganisationsService } from './organisations.service.js';

/**
 * A lab's or clinic's staff, managed by the account that runs it (owner decision O-1). Only the
 * owner roles may call these; the organisation is always the caller's own.
 */
@ApiTags('organisation')
@ApiBearerAuth()
@Controller('v1/organisation')
@UseGuards(requireFlag('accounts'))
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('lab', 'dentist', 'dermatologist')
  @ApiOkResponse({ type: OrganisationDto })
  async view(@Req() request: Request): Promise<OrganisationDto> {
    return this.organisations.view(principalOf(request));
  }

  @Put('name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('dentist', 'dermatologist')
  @ApiNoContentResponse()
  async name(@Body() body: OrganisationNameDto, @Req() request: Request): Promise<void> {
    await this.organisations.name(principalOf(request), body.name);
  }

  /** Inviting staff needs a fresh OTP (AC-05, decision L-11). */
  @Post('invitations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('lab', 'dentist', 'dermatologist')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async invite(@Body() body: InviteDto, @Req() request: Request): Promise<void> {
    await this.organisations.invite(principalOf(request), body.mobile);
  }

  /** Revokes an invitation or removes a member; takes effect at once (D-7). */
  @Delete('members/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('lab', 'dentist', 'dermatologist')
  @ApiNoContentResponse()
  async end(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.organisations.end(principalOf(request), id);
  }
}
