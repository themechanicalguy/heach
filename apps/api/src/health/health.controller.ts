import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { EnvVars } from '../config/env.schema.js';
import { HealthStatusDto, ReadinessDto } from './health.dto.js';
import { ReadinessService } from './readiness.service.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly env: EnvVars,
    private readonly readinessService: ReadinessService,
  ) {}

  /** Liveness: the process is up. Exposes status and build version only. */
  @Get('healthz')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: HealthStatusDto })
  liveness(): HealthStatusDto {
    return { status: 'ok', version: this.env.BUILD_VERSION ?? 'dev' };
  }

  /** Readiness: PostgreSQL and Redis reachable. 503 when either is down. */
  @Get('readyz')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ReadinessDto })
  @ApiServiceUnavailableResponse({ type: ReadinessDto })
  async readiness(@Res({ passthrough: true }) response: Response): Promise<ReadinessDto> {
    const result = await this.readinessService.check();
    if (result.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
