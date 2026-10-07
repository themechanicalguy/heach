import { ApiProperty } from '@nestjs/swagger';

/** Response schemas, so the OpenAPI document (and @heach/types) describe the health routes. */
export class HealthStatusDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ example: '0.1.0' })
  version!: string;
}

export class ReadinessChecksDto {
  @ApiProperty({ enum: ['ok', 'down'] })
  postgres!: 'ok' | 'down';

  @ApiProperty({ enum: ['ok', 'down'] })
  redis!: 'ok' | 'down';
}

export class ReadinessDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;
}
