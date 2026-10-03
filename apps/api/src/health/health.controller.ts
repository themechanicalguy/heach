import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnvVars } from '../config/env.schema.js';

export interface HealthStatus {
  status: 'ok';
  version: string;
}

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly env: EnvVars) {}

  /** Liveness: the process is up. Exposes status and build version only. */
  @Get('healthz')
  @Header('Cache-Control', 'no-store')
  liveness(): HealthStatus {
    return { status: 'ok', version: this.env.BUILD_VERSION ?? 'dev' };
  }

  /** Readiness: dependencies reachable. Database and Redis checks arrive with Docker Compose. */
  @Get('readyz')
  @Header('Cache-Control', 'no-store')
  readiness(): Pick<HealthStatus, 'status'> {
    return { status: 'ok' };
  }
}
