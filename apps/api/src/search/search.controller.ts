import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import {
  ProfileQueryDto,
  ProviderProfileDto,
  SearchQueryDto,
  SearchResultDto,
  ServicePriceDto,
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

  @Get('service-prices')
  @Public('Starting fees are public catalogue data from approved active listings')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ type: [ServicePriceDto] })
  async prices(): Promise<ServicePriceDto[]> {
    return this.search.startingPrices();
  }

  @Get('search')
  @Public('Finding a provider needs no account (SD-01 to SD-04)')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [SearchResultDto] })
  async find(@Query() query: SearchQueryDto): Promise<SearchResultDto[]> {
    return this.search.find(query);
  }

  @Post('search')
  @HttpCode(200)
  @Public('Search intent belongs in a request body, never in access-log URLs')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [SearchResultDto] })
  async searchBody(@Body() query: SearchQueryDto): Promise<SearchResultDto[]> {
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
