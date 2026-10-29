import {
  Body,
  Controller,
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
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CARE_ROLES } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { requireFlag } from '../flags/flags.module.js';
import { StoredFileDto } from '../onboarding/onboarding.dto.js';
import { ProviderAccess } from '../onboarding/provider-access.js';
import { ProfileQueryDto } from '../search/search.dto.js';
import { VisitCodeDto } from '../visits/visits.dto.js';
import {
  AdminLabDto,
  AssignCollectorDto,
  CollectorDto,
  LabDashboardDto,
  LabOrderDto,
  RecollectDto,
  ReportUploadDto,
  SampleCodeDto,
} from './labs.dto.js';
import { LabsService } from './labs.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** The patient's view of a lab order (LB-05 to LB-08). */
@ApiTags('bookings')
@ApiBearerAuth()
@Controller('v1/bookings/:id/lab')
@UseGuards(requireFlag('accounts'))
export class PatientLabController {
  constructor(private readonly labs: LabsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: LabOrderDto })
  async view(
    @Param('id', uuid) id: string,
    @Query() query: ProfileQueryDto,
    @Req() request: Request,
  ): Promise<LabOrderDto> {
    return this.labs.forPatient(principalOf(request).userId, id, query.locale ?? 'or');
  }

  @Get('code')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: VisitCodeDto })
  async code(@Param('id', uuid) id: string, @Req() request: Request): Promise<VisitCodeDto> {
    return this.labs.codeFor(principalOf(request).userId, id);
  }

  @Get('report')
  @Header('Cache-Control', 'no-store')
  @Roles(...CARE_ROLES)
  @ApiOkResponse({ type: StoredFileDto })
  async report(@Param('id', uuid) id: string, @Req() request: Request): Promise<StoredFileDto> {
    return this.labs.reportFile(principalOf(request).userId, id);
  }
}

/** The lab's orders and dashboard (LB-05 to LB-11); Approved labs only. */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/lab')
@UseGuards(requireFlag('accounts'))
export class LabController {
  constructor(
    private readonly labs: LabsService,
    private readonly access: ProviderAccess,
  ) {}

  @Get('orders')
  @Header('Cache-Control', 'no-store')
  @Roles('lab')
  @ApiOkResponse({ type: [LabOrderDto] })
  async orders(@Query() query: ProfileQueryDto, @Req() request: Request): Promise<LabOrderDto[]> {
    const labId = principalOf(request).userId;
    await this.access.approvedRole(labId);
    return this.labs.forLab(labId, query.locale ?? 'or');
  }

  @Get('collectors')
  @Header('Cache-Control', 'no-store')
  @Roles('lab')
  @ApiOkResponse({ type: [CollectorDto] })
  async collectors(@Req() request: Request): Promise<CollectorDto[]> {
    return this.labs.collectors(principalOf(request).userId);
  }

  @Get('dashboard')
  @Header('Cache-Control', 'no-store')
  @Roles('lab')
  @ApiOkResponse({ type: LabDashboardDto })
  async dashboard(@Req() request: Request): Promise<LabDashboardDto> {
    return this.labs.dashboard(principalOf(request).userId);
  }

  @Post('orders/:id/collector')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('lab')
  @ApiNoContentResponse()
  async assign(
    @Param('id', uuid) id: string,
    @Body() body: AssignCollectorDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.labs.assignCollector(principalOf(request), id, body.collectorId);
  }

  /** A walk-in sample taken at the lab, confirmed with the patient's code. */
  @Post('orders/:id/collect')
  @HttpCode(HttpStatus.OK)
  @Roles('lab')
  @ApiOkResponse()
  async collect(
    @Param('id', uuid) id: string,
    @Body() body: SampleCodeDto,
    @Req() request: Request,
  ): Promise<{ sampleId: string }> {
    return { sampleId: await this.labs.collect(principalOf(request), id, body.code) };
  }

  @Post('orders/:id/received')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('lab')
  @ApiNoContentResponse()
  async received(@Param('id', uuid) id: string, @Req() request: Request): Promise<void> {
    await this.labs.received(principalOf(request), id);
  }

  @Post('orders/:id/recollect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('lab')
  @ApiNoContentResponse()
  async recollect(
    @Param('id', uuid) id: string,
    @Body() body: RecollectDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.labs.recollect(principalOf(request), id, body.reason);
  }

  /** The report as PDF, with the upload content type (LB-08, LB-10). */
  @Post('orders/:id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('lab')
  @ApiNoContentResponse()
  async report(
    @Param('id', uuid) id: string,
    @Body() body: ReportUploadDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.labs.report(principalOf(request), id, body);
  }

  @Get('orders/:id/report')
  @Header('Cache-Control', 'no-store')
  @Roles('lab')
  @ApiOkResponse({ type: StoredFileDto })
  async reportFile(@Param('id', uuid) id: string, @Req() request: Request): Promise<StoredFileDto> {
    return this.labs.reportFile(principalOf(request).userId, id);
  }
}

/** A sample collector's assigned home collections (LB-05, LB-06). */
@ApiTags('provider')
@ApiBearerAuth()
@Controller('v1/provider/collections')
@UseGuards(requireFlag('accounts'))
export class CollectionsController {
  constructor(
    private readonly labs: LabsService,
    private readonly access: ProviderAccess,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('sample_collector')
  @ApiOkResponse({ type: [LabOrderDto] })
  async list(@Query() query: ProfileQueryDto, @Req() request: Request): Promise<LabOrderDto[]> {
    const collectorId = principalOf(request).userId;
    await this.access.approvedRole(collectorId);
    return this.labs.forCollector(collectorId, query.locale ?? 'or');
  }

  @Post(':id/collect')
  @HttpCode(HttpStatus.OK)
  @Roles('sample_collector')
  @ApiOkResponse()
  async collect(
    @Param('id', uuid) id: string,
    @Body() body: SampleCodeDto,
    @Req() request: Request,
  ): Promise<{ sampleId: string }> {
    const principal = principalOf(request);
    await this.access.approvedRole(principal.userId);
    return { sampleId: await this.labs.collect(principal, id, body.code) };
  }
}

/** Lab management (AD-13): orders, turnaround against promise and corrections per lab. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/labs')
@UseGuards(requireFlag('accounts'))
export class AdminLabsController {
  constructor(
    private readonly labs: LabsService,
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [AdminLabDto] })
  async list(): Promise<AdminLabDto[]> {
    const { rows } = await this.pool.query<{
      labId: string;
      name: string;
      orders: number;
      corrections: number;
    }>(
      `SELECT o.owner_account_id AS "labId", o.name,
              (SELECT count(*)::int FROM app.booking b JOIN app.lab_order lo ON lo.booking_id = b.id WHERE b.provider_account_id = o.owner_account_id) AS orders,
              (SELECT count(*)::int FROM app.lab_report r JOIN app.booking b ON b.id = r.booking_id
                WHERE b.provider_account_id = o.owner_account_id AND r.version > 1) AS corrections
         FROM app.organisation o WHERE o.kind = 'lab' ORDER BY o.name LIMIT 200`,
    );
    return Promise.all(
      rows.map(async (row) => ({ ...row, ...(await this.labs.dashboard(row.labId)) })),
    );
  }
}
