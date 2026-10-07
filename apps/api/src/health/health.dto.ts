import { ApiProperty } from '@nestjs/swagger';

/** Response schemas, so the OpenAPI document (and @heach/types) describe the health routes. */
export class ReadyStatusDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}

export class HealthStatusDto extends ReadyStatusDto {
  @ApiProperty({ example: '0.1.0' })
  version!: string;
}
