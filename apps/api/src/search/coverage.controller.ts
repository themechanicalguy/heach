import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { Public } from '../auth/roles.decorator.js';
import { SERVICES, type Service } from '../catalogue/services.js';
import { SearchRepository } from './search.repository.js';

export class CoverageInputDto {
  @ApiProperty({ description: 'Confidential search PIN; request body only, never logged' })
  @Matches(/^[1-9]\d{5}$/)
  pin!: string;
}

export class CoverageDto {
  @ApiProperty()
  served!: boolean;

  @ApiProperty({
    enum: SERVICES,
    isArray: true,
    description: 'Public services with published listings serving the requested area',
  })
  services!: Service[];
}

/** Public published-listing coverage, under the shared IP rate limiter. */
@ApiTags('search')
@Controller('v1/coverage')
export class CoverageController {
  constructor(private readonly search: SearchRepository) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Public('Coverage is public; the PIN stays in the request body')
  @ApiOkResponse({ type: CoverageDto })
  async check(@Body() body: CoverageInputDto): Promise<CoverageDto> {
    const services = await this.search.coverage(body.pin);
    return { served: services.length > 0, services };
  }
}
