import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { principalOf } from '../auth/auth.guard.js';
import { RequireReverification } from '../auth/reverification.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { CARE_ROLES } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { requireFlag } from '../flags/flags.module.js';
import { ONBOARDING_ROLES } from '../onboarding/checklists.js';
import { StoredFileDto } from '../onboarding/onboarding.dto.js';
import {
  AccessDto,
  HistoryEntryDto,
  HistoryInputDto,
  LinkCreatedDto,
  LinkDto,
  LinkInputDto,
  LinkOpenDto,
  ProviderRecordInputDto,
  RecordDto,
  RecordInputDto,
  RevokedSharesDto,
  ShareDto,
  ShareInputDto,
  SharedRecordsDto,
  UsageDto,
  VaultQueryDto,
  VaultStatsDto,
} from './vault.dto.js';
import { VaultRepository } from './vault.repository.js';
import { VaultService } from './vault.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });
const owner = (request: Request) => principalOf(request).userId;

/** The patient's own vault (J9; MV-01 to MV-15); a representative's covers their linked patients. */
@ApiTags('vault')
@ApiBearerAuth()
@Controller('v1/vault')
@UseGuards(requireFlag('accounts'))
export class VaultController {
  constructor(
    private readonly vault: VaultService,
    private readonly records: VaultRepository,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [RecordDto] })
  async list(@Query() query: VaultQueryDto, @Req() request: Request): Promise<RecordDto[]> {
    return this.vault.list(owner(request), query);
  }

  /** JSON, or the upload content type with a file (MV-03). */
  @Post('records')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: RecordDto })
  async upload(@Body() body: RecordInputDto, @Req() request: Request): Promise<RecordDto> {
    return this.vault.upload(owner(request), body);
  }

  @Get('records/:id/file')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: StoredFileDto })
  async file(@Param('id', uuid) id: string, @Req() request: Request): Promise<StoredFileDto> {
    return this.vault.file(owner(request), id);
  }

  @Get('records/:id/access')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [AccessDto] })
  async access(@Param('id', uuid) id: string, @Req() request: Request): Promise<AccessDto[]> {
    return this.vault.accessLog(owner(request), id);
  }

  @Delete('records/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async remove(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.vault.remove(owner(request), id);
  }

  @Get('usage')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: UsageDto })
  async usage(@Req() request: Request): Promise<UsageDto> {
    return this.vault.usage(owner(request));
  }

  @Get('history')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [HistoryEntryDto] })
  async history(@Req() request: Request): Promise<HistoryEntryDto[]> {
    return this.vault.history(owner(request));
  }

  @Post('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async addHistory(@Body() body: HistoryInputDto, @Req() request: Request): Promise<void> {
    await this.vault.addHistory(principalOf(request), body);
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async removeHistory(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.vault.removeHistory(owner(request), id);
  }

  @Get('shares')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [ShareDto] })
  async shares(@Req() request: Request): Promise<ShareDto[]> {
    return this.records.shares(owner(request));
  }

  @Post('shares')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...CARE_ROLES)
  @ApiOkResponse()
  async share(@Body() body: ShareInputDto, @Req() request: Request): Promise<{ id: string }> {
    return { id: await this.vault.share(owner(request), body) };
  }

  @Post('shares/:id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async revokeShare(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.vault.revokeShare(owner(request), id);
  }

  @Get('links')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: [LinkDto] })
  async links(@Req() request: Request): Promise<LinkDto[]> {
    return this.records.links(owner(request));
  }

  @Post('links')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: LinkCreatedDto })
  async link(@Body() body: LinkInputDto, @Req() request: Request): Promise<LinkCreatedDto> {
    return this.vault.createLink(owner(request), body);
  }

  @Post('links/:id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...CARE_ROLES)
  @ApiNoContentResponse()
  async revokeLink(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.vault.revokeLink(owner(request), id);
  }

  @Get('export')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Disposition', 'attachment; filename="heach-vault.json"')
  @Roles(...CARE_ROLES)
  @ApiOkResponse()
  async export(@Req() request: Request) {
    return this.vault.export(owner(request));
  }
}

/** The provider's "Shared records" panel and adding a record within a booking (MV-08, MV-14). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/bookings/:id')
@UseGuards(requireFlag('accounts'))
export class ProviderVaultController {
  constructor(private readonly vault: VaultService) {}

  @Get('shared')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: SharedRecordsDto })
  async shared(@Param('id', uuid) id: string, @Req() request: Request): Promise<SharedRecordsDto> {
    return this.vault.sharedWithProvider(principalOf(request), id);
  }

  @Get('shared/:recordId/file')
  @Header('Cache-Control', 'no-store')
  @Roles(...ONBOARDING_ROLES)
  @ApiOkResponse({ type: StoredFileDto })
  async sharedFile(
    @Param('id', uuid) id: string,
    @Param('recordId', uuid) recordId: string,
    @Req() request: Request,
  ): Promise<StoredFileDto> {
    return this.vault.sharedFile(principalOf(request), id, recordId);
  }

  @Post('records')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ONBOARDING_ROLES)
  @ApiNoContentResponse()
  async add(
    @Param('id', uuid) id: string,
    @Body() body: ProviderRecordInputDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.vault.addFromProvider(principalOf(request), id, body);
  }
}

/** A doctor outside the application opens a shared link with its code (MV-09). */
@ApiTags('vault')
@Controller('v1/shared-records')
@UseGuards(requireFlag('accounts'))
export class SharedLinkController {
  constructor(private readonly vault: VaultService) {}

  @Post(':token')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Public('The link and its one-time code are the authorisation (MV-09)')
  @ApiOkResponse({ type: SharedRecordsDto })
  async open(@Param('token') token: string, @Body() body: LinkOpenDto): Promise<SharedRecordsDto> {
    return this.vault.openLink(token, body.code);
  }
}

/** Vault operations without any content (AD-15). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/vault')
@UseGuards(requireFlag('accounts'))
export class AdminVaultController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    private readonly vault: VaultRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Breach containment (SO-09, breach runbook): every live booking share and outside link of one
   * account stops at once, without opening any record. Needs a fresh code; audited.
   */
  @Post('accounts/:accountId/revoke-shares')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'support')
  @UseGuards(RequireReverification)
  @ApiOkResponse({ type: RevokedSharesDto })
  async revokeShares(@Param('accountId', uuid) accountId: string): Promise<RevokedSharesDto> {
    const revoked = await this.vault.revokeAllFor(accountId);
    await this.audit.record({
      action: 'vault.shares_revoked',
      entity: 'account',
      entityId: accountId,
    });
    return revoked;
  }

  @Get('stats')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: VaultStatsDto })
  async stats(): Promise<VaultStatsDto> {
    const { rows } = await this.pool.query<VaultStatsDto>(
      `SELECT (SELECT count(*)::int FROM app.vault_record) AS records,
              (SELECT coalesce(sum(o.size_bytes), 0)::int FROM app.vault_record r JOIN app.stored_object o ON o.id = r.object_id) AS "storageBytes",
              (SELECT count(*)::int FROM app.stored_object WHERE scan_status = 'infected') AS "infectedUploads",
              (SELECT count(*)::int FROM app.record_share WHERE revoked_at IS NULL AND expires_at > now()) AS "activeShares",
              (SELECT count(*)::int FROM app.external_share WHERE revoked_at IS NULL AND expires_at > now()) AS "activeLinks",
              (SELECT count(*)::int FROM app.deletion_request WHERE status = 'pending') AS "openDeletionRequests"`,
    );
    return (
      rows[0] ?? {
        records: 0,
        storageBytes: 0,
        infectedUploads: 0,
        activeShares: 0,
        activeLinks: 0,
        openDeletionRequests: 0,
      }
    );
  }
}
