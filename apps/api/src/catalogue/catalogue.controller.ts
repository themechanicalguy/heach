import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../auth/roles.decorator.js';
import { AuditService } from '../audit/audit.service.js';
import { requireFlag } from '../flags/flags.module.js';
import {
  CatalogueChangeDto,
  CatalogueItemDto,
  CatalogueQueryDto,
  PinChangeDto,
  PinCodeDto,
} from './catalogue.dto.js';
import { CatalogueRepository } from './catalogue.repository.js';

/** The public catalogue, in the reader's language (SL-02 to SL-09, I18N-05). */
@ApiTags('catalogue')
@Controller('v1/catalogue')
@UseGuards(requireFlag('accounts'))
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueRepository) {}

  @Get()
  @Public('The service catalogue is public, for indexable pages (SD-05)')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ type: [CatalogueItemDto] })
  async list(@Query() query: CatalogueQueryDto): Promise<CatalogueItemDto[]> {
    const items = await this.catalogue.items(query.locale ?? 'or', {
      ...(query.service ? { service: query.service } : {}),
      activeOnly: true,
    });
    return items;
  }
}

/** Catalogue and serviceable PIN codes for super admins (AD-04, AD-08); every change audited. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1')
@UseGuards(requireFlag('accounts'))
export class CatalogueAdminController {
  constructor(
    private readonly catalogue: CatalogueRepository,
    private readonly audit: AuditService,
  ) {}

  @Get('catalogue')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [CatalogueItemDto] })
  async list(): Promise<CatalogueItemDto[]> {
    return this.catalogue.items('en', { activeOnly: false });
  }

  @Put('catalogue/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @ApiNoContentResponse()
  async change(@Param('code') code: string, @Body() body: CatalogueChangeDto): Promise<void> {
    await this.catalogue.transaction(async (client) => {
      if (!(await this.catalogue.item(code))) throw new NotFoundException();
      if (body.active !== undefined) await this.catalogue.setActive(client, code, body.active);
      for (const locale of ['or', 'en', 'hi'] as const) {
        const name = body.names?.[locale];
        if (name) await this.catalogue.rename(client, code, locale, name);
      }
      await this.audit.record(
        { action: 'catalogue_item.changed', entity: 'catalogue_item', entityId: code },
        client,
      );
    });
  }

  @Get('pins')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [PinCodeDto] })
  async pins(): Promise<PinCodeDto[]> {
    return this.catalogue.pins();
  }

  @Put('pins/:pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @ApiNoContentResponse()
  async setPin(@Param('pin') pin: string, @Body() body: PinChangeDto): Promise<void> {
    await this.catalogue.transaction(async (client) => {
      if (!(await this.catalogue.setPin(client, pin, body.serviceable)))
        throw new NotFoundException();
      await this.audit.record(
        { action: 'pin_code.changed', entity: 'pin_code', entityId: pin },
        client,
      );
    });
  }
}
