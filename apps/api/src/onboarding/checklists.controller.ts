import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { AuditService } from '../audit/audit.service.js';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { ChecklistSettings } from './checklist-settings.js';
import { ONBOARDING_ROLES } from './checklists.js';

export class ChecklistSettingDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  required!: boolean;

  @ApiProperty()
  reference!: boolean;

  @ApiProperty()
  expiry!: boolean;

  @ApiProperty({ description: 'Required by an owner decision; cannot be made optional' })
  fixed!: boolean;
}

export class ChecklistRoleDto {
  @ApiProperty({ enum: ONBOARDING_ROLES })
  role!: string;

  @ApiProperty({ type: [ChecklistSettingDto] })
  items!: ChecklistSettingDto[];
}

export class ChecklistInputDto {
  @ApiProperty()
  @IsBoolean()
  required!: boolean;
}

/** Document checklists per provider type for admins (AD-08): which items are required. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/checklists')
@UseGuards(requireFlag('accounts'))
export class AdminChecklistsController {
  constructor(
    private readonly checklists: ChecklistSettings,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'verifier', 'support')
  @ApiOkResponse({ type: [ChecklistRoleDto] })
  async list(): Promise<ChecklistRoleDto[]> {
    return this.checklists.all();
  }

  @Put(':role/:item')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  async set(
    @Param('role') role: string,
    @Param('item') item: string,
    @Body() body: ChecklistInputDto,
  ): Promise<void> {
    await this.checklists.set(role, item, body.required);
    await this.audit.record({
      action: 'checklist.changed',
      entity: 'checklist_setting',
      entityId: `${role}:${item}`,
    });
  }
}
