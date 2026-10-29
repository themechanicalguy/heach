import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { actorOf } from '../bookings/booking-actor.js';
import { CARE_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { CodeDto, ShiftDto, VisitCodeDto, VisitNotesDto, VisitRecordDto } from './visits.dto.js';
import { VisitsService } from './visits.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** The patient's side of a visit: the code, shifts, notes, and reporting an absent provider. */
@ApiTags('bookings')
@ApiBearerAuth()
@Controller('v1/bookings/:id')
@UseGuards(requireFlag('accounts'))
export class PatientVisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get('code')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: VisitCodeDto })
  async code(@Param('id', uuid) id: string, @Req() request: Request): Promise<VisitCodeDto> {
    return this.visits.codeFor(principalOf(request).userId, id);
  }

  @Get('shifts')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [ShiftDto] })
  async shifts(@Param('id', uuid) id: string, @Req() request: Request): Promise<ShiftDto[]> {
    return this.visits.shifts(principalOf(request).userId, id);
  }

  @Get('visit-notes')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: VisitRecordDto })
  async notes(
    @Param('id', uuid) id: string,
    @Req() request: Request,
  ): Promise<VisitRecordDto | null> {
    return (await this.visits.notesFor(principalOf(request).userId, id)) ?? null;
  }

  @Post('provider-no-show')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async providerAbsent(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.visits.providerAbsent(id, actorOf(principalOf(request)));
  }
}

/** The provider's side of a visit (HS-03 to HS-05, A15). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/bookings/:id')
@UseGuards(requireFlag('accounts'))
export class ProviderVisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post('start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async start(
    @Param('id', uuid) id: string,
    @Body() body: CodeDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.visits.start(principalOf(request), id, body.code);
  }

  @Post('complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async complete(
    @Param('id', uuid) id: string,
    @Body() body: VisitNotesDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.visits.complete(principalOf(request), id, body);
  }

  @Post('no-show')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async patientAbsent(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.visits.patientAbsent(principalOf(request), id);
  }

  @Get('shifts')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: [ShiftDto] })
  async shifts(@Param('id', uuid) id: string, @Req() request: Request): Promise<ShiftDto[]> {
    return this.visits.shifts(principalOf(request).userId, id);
  }

  @Post('shifts/:day/check-in')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async checkIn(
    @Param('id', uuid) id: string,
    @Param('day', ParseIntPipe) day: number,
    @Body() body: CodeDto,
    @Req() request: Request,
  ) {
    await this.visits.checkShift(principalOf(request), id, day, 'in', body.code);
  }

  @Post('shifts/:day/check-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async checkOut(
    @Param('id', uuid) id: string,
    @Param('day', ParseIntPipe) day: number,
    @Body() body: CodeDto,
    @Req() request: Request,
  ) {
    await this.visits.checkShift(principalOf(request), id, day, 'out', body.code);
  }
}
