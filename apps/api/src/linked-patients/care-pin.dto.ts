import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class CarePersonDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Confidential linked-person ID; absent means the account holder',
  })
  @IsOptional()
  @IsUUID('4')
  person?: string;
}

export class CarePinInputDto extends CarePersonDto {
  @ApiProperty({ description: 'Confidential saved search PIN, never in URLs or logs' })
  @Matches(/^[1-9]\d{5}$/)
  pin!: string;
}

export class CarePinDto {
  @ApiProperty({ type: String, nullable: true })
  pin!: string | null;
}

export class ExportCarePinDto extends CarePinDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  person!: string | null;
}
