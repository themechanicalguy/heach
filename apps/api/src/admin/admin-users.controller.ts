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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { SuspendDto, UserDetailDto, UserPageDto, UserQueryDto } from './admin.dto.js';
import { AdminUsersService } from './admin-users.service.js';

/**
 * User management (AD-03). Super admin, support and verifier may look; only super admin and
 * support may suspend or reinstate, after a fresh TOTP code. Finance has no access.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/users')
@UseGuards(requireFlag('accounts'))
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support', 'verifier')
  @ApiOkResponse({ type: UserPageDto })
  async list(@Query() query: UserQueryDto): Promise<UserPageDto> {
    return this.users.list(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support', 'verifier')
  @ApiOkResponse({ type: UserDetailDto })
  async view(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UserDetailDto> {
    return this.users.view(id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async suspend(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: SuspendDto,
  ): Promise<void> {
    await this.users.suspend(id, body.reason);
  }

  @Post(':id/reinstate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin', 'support')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async reinstate(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
    await this.users.reinstate(id);
  }
}
