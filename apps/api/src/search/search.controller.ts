import { Controller, Get, Header, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import {
  ProfileQueryDto,
  ProviderProfileDto,
  SearchQueryDto,
  SearchResultDto,
  SlotQueryDto,
  SlotsDto,
} from './search.dto.js';
import { SearchService } from './search.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/** Public search, provider profiles and open slots (SD-02 to SD-05, PO-05, AV-02). */
@ApiTags('search')
@Controller('v1')
@UseGuards(requireFlag('accounts'))
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @Public('Finding a provider needs no account (SD-01 to SD-04)')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [SearchResultDto] })
  async find(@Query() query: SearchQueryDto): Promise<SearchResultDto[]> {
    return this.search.find(query);
  }

  @Get('providers/:id')
  @Public('Public provider profile pages are indexable (SD-05, PO-05)')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ type: ProviderProfileDto })
  async profile(
    @Param('id', uuid) id: string,
    @Query() query: ProfileQueryDto,
  ): Promise<ProviderProfileDto> {
    return this.search.profile(id, query.locale ?? 'or');
  }

  @Get('providers/:id/slots')
  @Public('Open times are public so a patient can choose before signing in')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: SlotsDto })
  async slots(@Param('id', uuid) id: string, @Query() query: SlotQueryDto): Promise<SlotsDto> {
    return { slots: await this.search.listingSlots(id, query.listing, query.days ?? 7) };
  }
}
