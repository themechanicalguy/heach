import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { SERVICES, type Service } from './services.js';

const LOCALES = ['or', 'en', 'hi'] as const;

export class CatalogueQueryDto {
  @ApiPropertyOptional({ enum: SERVICES })
  @IsOptional()
  @IsIn(SERVICES)
  service?: Service;

  @ApiPropertyOptional({ enum: LOCALES })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: (typeof LOCALES)[number];
}

export class CatalogueItemDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: SERVICES })
  service!: Service;

  @ApiProperty({ enum: ['visit', 'shift', 'lab_test'] })
  kind!: 'visit' | 'shift' | 'lab_test';

  @ApiProperty()
  clinical!: boolean;

  @ApiProperty({ description: 'A prescription must be attached before booking (SL-06)' })
  prescriptionRequired!: boolean;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty({ type: String, nullable: true })
  sampleType!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  reportHours!: number | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  preparation!: string | null;

  @ApiProperty()
  active!: boolean;
}

export class ItemNamesDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  or!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  en!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  hi!: string;
}

export class CatalogueChangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: ItemNamesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ItemNamesDto)
  names?: ItemNamesDto;
}

export class PinCodeDto {
  @ApiProperty()
  pin!: string;

  @ApiProperty()
  district!: string;

  @ApiProperty()
  serviceable!: boolean;
}

export class PinChangeDto {
  @ApiProperty()
  @IsBoolean()
  serviceable!: boolean;
}
