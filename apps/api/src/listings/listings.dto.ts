import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, Matches, Max, Min } from 'class-validator';
import { PinCodeDto } from '../catalogue/catalogue.dto.js';

export class ListingInputDto {
  @ApiProperty({ description: 'Fee in paise', minimum: 100 })
  @IsInt()
  @Min(100)
  @Max(10_000_000)
  feePaise!: number;

  @ApiProperty({ minimum: 10, maximum: 1440 })
  @IsInt()
  @Min(10)
  @Max(1440)
  durationMinutes!: number;

  @ApiProperty({ description: 'Pause and resume without admin action (SL-07)' })
  @IsBoolean()
  active!: boolean;

  @ApiProperty({ type: [String], enum: ['home', 'hospital'], description: 'Attendants (SL-04)' })
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(['home', 'hospital'], { each: true })
  careSettings!: ('home' | 'hospital')[];

  @ApiProperty({ description: 'Labs: sample collection at home is offered (SL-09)' })
  @IsBoolean()
  homeCollection!: boolean;
}

export class ListingDto extends ListingInputDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}

export class ListableItemDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['visit', 'shift', 'lab_test'] })
  kind!: 'visit' | 'shift' | 'lab_test';

  @ApiProperty()
  prescriptionRequired!: boolean;

  @ApiProperty()
  defaultDurationMinutes!: number;

  @ApiProperty({ type: ListingDto, nullable: true })
  listing!: ListingDto | null;
}

export class ProviderListingsDto {
  @ApiProperty()
  role!: string;

  @ApiProperty({ type: [ListableItemDto] })
  items!: ListableItemDto[];

  @ApiProperty({ type: [String] })
  pins!: string[];

  @ApiProperty()
  travelSurchargePaise!: number;

  @ApiProperty({ type: [PinCodeDto] })
  serviceablePins!: PinCodeDto[];
}

export class ServiceAreaDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(/^[1-9]\d{5}$/, { each: true })
  pins!: string[];

  @ApiProperty({ description: 'Travel surcharge in paise (SL-05)', minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(100_000)
  travelSurchargePaise!: number;
}
