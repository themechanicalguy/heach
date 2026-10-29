import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { reason } from '../common/error-response.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { ProviderAccess } from '../onboarding/provider-access.js';
import {
  AvailabilityDto,
  AvailabilityInputDto,
  BlockDto,
  BlockInputDto,
} from './availability.dto.js';
import { AvailabilityRepository } from './availability.repository.js';

const ENTITY = 'availability';
const MAX_BLOCK_DAYS = 90;

/** An Approved provider's weekly hours, buffer and leave (AV-01, AV-03). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/availability')
@UseGuards(requireFlag('accounts'))
export class AvailabilityController {
  constructor(
    private readonly availability: AvailabilityRepository,
    private readonly access: ProviderAccess,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: AvailabilityDto })
  async view(@Req() request: Request): Promise<AvailabilityDto> {
    const accountId = principalOf(request).userId;
    await this.access.approvedRole(accountId);
    const [rules, bufferMinutes, blocks] = await Promise.all([
      this.availability.rules(accountId),
      this.availability.bufferMinutes(accountId),
      this.availability.blocks(accountId, new Date()),
    ]);
    return { rules, bufferMinutes, blocks };
  }

  @Put()
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: AvailabilityDto })
  async replace(
    @Body() body: AvailabilityInputDto,
    @Req() request: Request,
  ): Promise<AvailabilityDto> {
    const accountId = principalOf(request).userId;
    await this.access.approvedRole(accountId);
    if (body.rules.some((rule) => rule.endMinute <= rule.startMinute)) {
      throw reason(BadRequestException, 'availability_invalid');
    }
    await this.availability.transaction(async (client) => {
      await this.availability.replaceRules(client, accountId, body.rules);
      await this.availability.setBuffer(client, accountId, body.bufferMinutes);
      await this.audit.record(
        { action: `${ENTITY}.changed`, entity: ENTITY, entityId: accountId },
        client,
      );
    });
    return this.view(request);
  }

  @Post('blocks')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: BlockDto })
  async block(@Body() body: BlockInputDto, @Req() request: Request): Promise<BlockDto> {
    const accountId = principalOf(request).userId;
    await this.access.approvedRole(accountId);
    const days = (body.end.getTime() - body.start.getTime()) / 86_400_000;
    if (days <= 0 || days > MAX_BLOCK_DAYS)
      throw reason(BadRequestException, 'availability_invalid');
    const id = await this.availability.addBlock(accountId, body);
    return { id, start: body.start, end: body.end };
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async unblock(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ): Promise<void> {
    const accountId = principalOf(request).userId;
    await this.access.approvedRole(accountId);
    if (!(await this.availability.removeBlock(accountId, id))) throw new NotFoundException();
  }
}
