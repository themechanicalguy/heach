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
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CARE_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { LinkedPatientDto, LinkedPatientInputDto } from './linked-patients.dto.js';
import { LinkedPatientsService } from './linked-patients.service.js';

/** The caller's own linked patients (AC-03); care roles only. */
@ApiTags('account')
@ApiBearerAuth()
@Controller('v1/me/linked-patients')
@UseGuards(requireFlag('accounts'))
export class LinkedPatientsController {
  constructor(private readonly linked: LinkedPatientsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [LinkedPatientDto] })
  async list(@Req() request: Request): Promise<LinkedPatientDto[]> {
    return this.linked.list(principalOf(request));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: LinkedPatientDto })
  async add(
    @Body() body: LinkedPatientInputDto,
    @Req() request: Request,
  ): Promise<LinkedPatientDto> {
    return this.linked.add(principalOf(request), body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async edit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: LinkedPatientInputDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.linked.edit(principalOf(request), id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.linked.remove(principalOf(request), id);
  }
}
