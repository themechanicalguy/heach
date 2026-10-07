import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EnvVars } from '../config/env.schema.js';
import { HealthStatusDto, ReadyStatusDto } from './health.dto.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly env: EnvVars) {}

  /** Liveness: the process is up. Exposes status and build version only. */
  @Get('healthz')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: HealthStatusDto })
  liveness(): HealthStatusDto {
    return { status: 'ok', version: this.env.BUILD_VERSION ?? 'dev' };
  }

  /** Readiness: dependencies reachable. Database and Redis checks arrive with Docker Compose. */
  @Get('readyz')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ReadyStatusDto })
  readiness(): ReadyStatusDto {
    return { status: 'ok' };
  }
}
