import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { RequireReverification } from '../auth/reverification.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { AuditFilterDto, AuditPageDto, AuditSearchQueryDto } from './audit-search.dto.js';
import { AuditSearchService } from './audit-search.service.js';

/** Search and export of the audit log: super admin only, export after a fresh TOTP (AD-11). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/audit')
@UseGuards(requireFlag('accounts'))
export class AuditController {
  constructor(private readonly search: AuditSearchService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin')
  @ApiOkResponse({ type: AuditPageDto })
  async list(@Query() query: AuditSearchQueryDto): Promise<AuditPageDto> {
    return this.search.search(query);
  }

  @Get('export')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiProduces('text/csv')
  @ApiOkResponse({
    schema: { type: 'string' },
    description: 'CSV, newest first, at most 5000 rows',
  })
  @ApiForbiddenResponse({ description: 'reverification_required' })
  async exportCsv(@Query() query: AuditFilterDto): Promise<string> {
    return this.search.exportCsv(query);
  }
}
