import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SERVICES, type Service } from '../catalogue/services.js';

const LOCALES = ['or', 'en', 'hi'] as const;

export class SearchQueryDto {
  @ApiProperty({ enum: SERVICES })
  @IsIn(SERVICES)
  service!: Service;

  @ApiProperty({ description: "Patient's PIN code: results are limited to it (SD-04)" })
  @Matches(/^[1-9]\d{5}$/)
  pin!: string;

  @ApiPropertyOptional({ description: 'Catalogue item code' })
  @IsOptional()
  @Matches(/^[a-z0-9_]{2,60}$/)
  item?: string;

  @ApiPropertyOptional({ description: 'Provider or service name, any of the three languages' })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  q?: string;

  @ApiPropertyOptional({ enum: ['female', 'male'] })
  @IsOptional()
  @IsIn(['female', 'male'])
  gender?: 'female' | 'male';

  @ApiPropertyOptional({ enum: LOCALES, description: 'Language the provider speaks' })
  @IsOptional()
  @IsIn(LOCALES)
  language?: (typeof LOCALES)[number];

  @ApiPropertyOptional({ description: 'Highest fee in paise' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  maxFeePaise?: number;

  @ApiPropertyOptional({ enum: LOCALES, description: 'Language of the result text' })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: (typeof LOCALES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Lowest average rating (SD-03)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;
}

export class SearchResultDto {
  @ApiProperty({ format: 'uuid' })
  providerId!: string;

  @ApiProperty({ format: 'uuid' })
  listingId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ type: String, nullable: true })
  gender!: string | null;

  @ApiProperty({ type: [String] })
  languages!: string[];

  @ApiProperty()
  itemCode!: string;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ enum: ['visit', 'shift', 'lab_test'] })
  kind!: 'visit' | 'shift' | 'lab_test';

  @ApiProperty()
  prescriptionRequired!: boolean;

  @ApiProperty()
  feePaise!: number;

  @ApiProperty()
  travelSurchargePaise!: number;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Earliest bookable time in the next 7 days',
  })
  earliestSlot!: Date | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Average rating, 1 to 5' })
  rating!: number | null;

  @ApiProperty()
  ratingCount!: number;
}

export class ProfileListingDto {
  @ApiProperty({ format: 'uuid' })
  listingId!: string;

  @ApiProperty()
  itemCode!: string;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ enum: ['visit', 'shift', 'lab_test'] })
  kind!: 'visit' | 'shift' | 'lab_test';

  @ApiProperty()
  prescriptionRequired!: boolean;

  @ApiProperty()
  feePaise!: number;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty({ type: String, nullable: true })
  preparation!: string | null;
}

export class ProviderProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ type: String, nullable: true })
  gender!: string | null;

  @ApiProperty({ type: [String] })
  languages!: string[];

  @ApiProperty({ description: '"Verified identity" badge (KY-09)' })
  identityVerified!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Nursing council registration (PO-05)',
  })
  registrationNumber!: string | null;

  @ApiProperty({ type: [ProfileListingDto] })
  listings!: ProfileListingDto[];

  @ApiProperty({ type: [String] })
  pins!: string[];

  @ApiProperty()
  travelSurchargePaise!: number;

  @ApiProperty({ type: Number, nullable: true })
  rating!: number | null;

  @ApiProperty()
  ratingCount!: number;
}

export class SlotQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  listing!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  days?: number;
}

export class SlotsDto {
  @ApiProperty({ type: [Date] })
  slots!: Date[];
}

export class ProfileQueryDto {
  @ApiPropertyOptional({ enum: LOCALES })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: (typeof LOCALES)[number];
}
