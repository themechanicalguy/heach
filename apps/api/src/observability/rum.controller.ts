import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsNumber, Matches, Max, Min } from 'class-validator';
import { Public } from '../auth/roles.decorator.js';
import { appLogger } from '../common/app-logger.js';

export class WebVitalDto {
  @IsIn(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(600_000)
  value!: number;

  /** Route template such as `/[locale]/notes`, never a URL with IDs. */
  @Matches(/^\/[\w[\]/-]{0,100}$/)
  route!: string;

  @IsIn(['mobile', 'tablet', 'desktop'])
  device!: string;
}

/** Real-user Core Web Vitals from the web app (LM-04.1), logged per route and device class. */
@ApiTags('observability')
@Controller('v1/rum')
export class RumController {
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public('Anonymous browser metrics: no identity, rate limited')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiNoContentResponse()
  record(@Body() vital: WebVitalDto): void {
    appLogger.info(
      { vital: vital.name, value: vital.value, route: vital.route, device: vital.device },
      'web-vital',
    );
  }
}
