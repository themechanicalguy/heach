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
import type { Locale } from '@heach/i18n';
import { AuditService } from '../audit/audit.service.js';
import { RequireReverification } from '../auth/reverification.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import {
  CONTENT_LOCALES,
  PAGE_SLUGS,
  PageDto,
  PageInputDto,
  PageQueryDto,
  type PageSlug,
  TemplateDto,
  TemplateInputDto,
} from './content.dto.js';
import { ContentService } from './content.service.js';

function localeOf(value: string): Locale {
  if (!(CONTENT_LOCALES as readonly string[]).includes(value)) throw new NotFoundException();
  return value as Locale;
}

function slugOf(value: string): PageSlug {
  if (!(PAGE_SLUGS as readonly string[]).includes(value)) throw new NotFoundException();
  return value as PageSlug;
}

/** Static pages for everyone: terms, privacy, questions and refunds per language (AD-09). */
@ApiTags('content')
@Controller('v1/pages')
export class PagesController {
  constructor(private readonly content: ContentService) {}

  @Get(':slug')
  @Public('Terms, privacy and help pages are read before signing up')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ type: PageDto })
  async page(@Param('slug') slug: string, @Query() query: PageQueryDto): Promise<PageDto> {
    return this.content.page(slugOf(slug), query.locale ?? 'or');
  }
}

/** Content for admins (AD-09): support reads, a super admin changes it after a fresh code. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/content')
@UseGuards(requireFlag('accounts'))
export class AdminContentController {
  constructor(
    private readonly content: ContentService,
    private readonly audit: AuditService,
  ) {}

  @Get('templates')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [TemplateDto] })
  async templates(): Promise<TemplateDto[]> {
    return this.content.templates();
  }

  @Put('templates/:template/:locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  async setTemplate(
    @Param('template') template: string,
    @Param('locale') locale: string,
    @Body() body: TemplateInputDto,
  ): Promise<void> {
    await this.content.setTemplate(template, localeOf(locale), body.text ?? null);
    await this.audit.record({
      action: 'content.template_changed',
      entity: 'message_override',
      entityId: `${template}:${locale}`,
    });
  }

  @Get('pages')
  @Header('Cache-Control', 'no-store')
  @Roles('super_admin', 'support')
  @ApiOkResponse({ type: [PageDto] })
  async pages(): Promise<PageDto[]> {
    return this.content.pages();
  }

  @Put('pages/:slug/:locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('super_admin')
  @UseGuards(RequireReverification)
  @ApiNoContentResponse()
  async setPage(
    @Param('slug') slug: string,
    @Param('locale') locale: string,
    @Body() body: PageInputDto,
  ): Promise<void> {
    await this.content.setPage(slugOf(slug), localeOf(locale), body.title, body.body);
    await this.audit.record({
      action: 'content.page_changed',
      entity: 'content_page',
      entityId: `${slug}:${locale}`,
    });
  }
}
