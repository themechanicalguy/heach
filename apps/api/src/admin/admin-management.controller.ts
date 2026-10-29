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
import {
  AdminRoleDto,
  AdminStatusDto,
  AdminSummaryDto,
  CreatedAdminDto,
  NewAdminDto,
  TemporaryPasswordDto,
} from './admin.dto.js';
import { AdminManagementService } from './admin-management.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** Admin accounts, managed by super admins only, each change after a fresh TOTP (AD-01, O-2). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/admins')
@UseGuards(requireFlag('accounts'))
export class AdminManagementController {
  constructor(private readonly management: AdminManagementService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin')
  @ApiOkResponse({ type: [AdminSummaryDto] })
  async list(): Promise<AdminSummaryDto[]> {
    const admins = await this.management.list();
    return admins.map((admin) => ({
      ...admin,
      createdAt: admin.createdAt.toISOString(),
      lastSignInAt: admin.lastSignInAt?.toISOString() ?? null,
    }));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: CreatedAdminDto })
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async create(@Body() body: NewAdminDto): Promise<CreatedAdminDto> {
    return this.management.create(body.email, body.role);
  }

  @Put(':id/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  async changeRole(
    @Param('id', uuid) id: string,
    @Body() body: AdminRoleDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.management.changeRole(principalOf(request), id, body.role);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  async setStatus(
    @Param('id', uuid) id: string,
    @Body() body: AdminStatusDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.management.setStatus(principalOf(request), id, body.status);
  }

  @Post(':id/password-reset')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: TemporaryPasswordDto })
  async resetPassword(
    @Param('id', uuid) id: string,
    @Req() request: Request,
  ): Promise<TemporaryPasswordDto> {
    return this.management.resetPassword(principalOf(request), id);
  }

  @Post(':id/mfa-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  async resetMfa(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.management.resetMfa(principalOf(request), id);
  }
}
