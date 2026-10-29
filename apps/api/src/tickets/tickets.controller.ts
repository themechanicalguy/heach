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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { GRANTED_USER_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import {
  AccessEntryDto,
  BreakGlassDto,
  NoteInputDto,
  ResolveDto,
  TicketDto,
  TicketInputDto,
  TicketQueryDto,
  TicketRestrictedDto,
} from './tickets.dto.js';
import { TicketsService } from './tickets.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** Raising and following one's own tickets (HS-06, RF-03), and the break-glass history (SE-06). */
@ApiTags('tickets')
@ApiBearerAuth()
@Controller('v1')
@UseGuards(requireFlag('accounts'))
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...GRANTED_USER_ROLES)
  @ApiOkResponse({ type: TicketDto })
  async raise(@Body() body: TicketInputDto, @Req() request: Request): Promise<TicketDto> {
    return this.tickets.raise(principalOf(request), body);
  }

  @Get('tickets')
  @Header('Cache-Control', 'no-store')
  @Roles(...GRANTED_USER_ROLES)
  @ApiOkResponse({ type: [TicketDto] })
  async mine(@Req() request: Request): Promise<TicketDto[]> {
    return this.tickets.mine(principalOf(request).userId);
  }

  @Get('me/access-history')
  @Header('Cache-Control', 'no-store')
  @Roles(...GRANTED_USER_ROLES)
  @ApiOkResponse({ type: [AccessEntryDto] })
  async history(@Req() request: Request): Promise<AccessEntryDto[]> {
    return this.tickets.accessHistory(principalOf(request).userId);
  }
}

/** The complaints and safety queue (AD-06), with break-glass for Restricted content (SE-03). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/tickets')
@UseGuards(requireFlag('accounts'))
export class AdminTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [TicketDto] })
  async queue(@Query() query: TicketQueryDto): Promise<TicketDto[]> {
    return this.tickets.queue(query.status);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async assign(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.tickets.assign(principalOf(request), id);
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async note(
    @Param('id', uuid) id: string,
    @Body() body: NoteInputDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.tickets.note(principalOf(request), id, body.note);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async resolve(@Param('id', uuid) id: string, @Body() body: ResolveDto): Promise<void> {
    await this.tickets.resolve(id, body.resolution);
  }

  @Post(':id/break-glass')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @ApiNoContentResponse()
  async breakGlass(
    @Param('id', uuid) id: string,
    @Body() body: BreakGlassDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.tickets.breakGlass(principalOf(request), id, body.reason);
  }

  @Get(':id/restricted')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: TicketRestrictedDto })
  async restricted(
    @Param('id', uuid) id: string,
    @Req() request: Request,
  ): Promise<TicketRestrictedDto> {
    return this.tickets.restricted(principalOf(request), id);
  }
}
