import { Body, Controller, Header, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CARE_ROLES } from '../common/request-context.js';
import { requireFlag } from '../flags/flags.module.js';
import { CarePersonDto, CarePinDto, CarePinInputDto } from './care-pin.dto.js';
import { LinkedPatientsRepository } from './linked-patients.repository.js';

/** Confidential location preferences: authorized by owner, with person IDs in request bodies. */
@ApiTags('account')
@ApiBearerAuth()
@Controller('v1/me/care-pin')
@UseGuards(requireFlag('accounts'))
@Roles(...CARE_ROLES)
export class CarePinController {
  constructor(private readonly people: LinkedPatientsRepository) {}

  @Header('Cache-Control', 'no-store')
  @Post('read')
  @HttpCode(200)
  @ApiOkResponse({ type: CarePinDto })
  async read(@Body() body: CarePersonDto, @Req() request: Request): Promise<CarePinDto> {
    const owner = principalOf(request).userId;
    await this.people.assertOwnedPerson(owner, body.person);
    return { pin: await this.people.carePin(owner, body.person) };
  }

  @Header('Cache-Control', 'no-store')
  @Put()
  @HttpCode(204)
  @ApiNoContentResponse()
  async save(@Body() body: CarePinInputDto, @Req() request: Request): Promise<void> {
    await this.people.saveCarePin(principalOf(request).userId, body.person, body.pin);
  }
}
