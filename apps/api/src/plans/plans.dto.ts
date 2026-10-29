import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SERVICES } from '../catalogue/services.js';

const LOCALES = ['or', 'en', 'hi'] as const;

export class PlanTextDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ maxLength: 600 })
  @IsString()
  @Length(1, 600)
  inclusions!: string;

  @ApiProperty({ maxLength: 600 })
  @IsString()
  @Length(1, 600)
  exclusions!: string;
}

export class PlanTextsDto {
  @ApiProperty({ type: PlanTextDto })
  @ValidateNested()
  @Type(() => PlanTextDto)
  or!: PlanTextDto;

  @ApiProperty({ type: PlanTextDto })
  @ValidateNested()
  @Type(() => PlanTextDto)
  en!: PlanTextDto;

  @ApiProperty({ type: PlanTextDto })
  @ValidateNested()
  @Type(() => PlanTextDto)
  hi!: PlanTextDto;
}

export class PlanInputDto {
  @ApiProperty({ enum: ['package', 'subscription'] })
  @IsIn(['package', 'subscription'])
  kind!: 'package' | 'subscription';

  @ApiPropertyOptional({ description: 'Packages: the catalogue item covered' })
  @IsOptional()
  @Matches(/^[a-z0-9_]{2,60}$/)
  itemCode?: string;

  @ApiPropertyOptional({ enum: SERVICES, description: 'Subscriptions: the service covered' })
  @IsOptional()
  @IsIn(SERVICES)
  service?: (typeof SERVICES)[number];

  @ApiProperty({ minimum: 1, maximum: 365, description: 'Sessions, visits or days included' })
  @IsInt()
  @Min(1)
  @Max(365)
  units!: number;

  @ApiProperty({
    minimum: 0,
    maximum: 50,
    description: 'Discount once the included units are used',
  })
  @IsInt()
  @Min(0)
  @Max(50)
  discountPercent!: number;

  @ApiPropertyOptional({ enum: ['monthly', 'quarterly', 'yearly'] })
  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'yearly'])
  period?: 'monthly' | 'quarterly' | 'yearly';

  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  familyMembers!: number;

  @ApiProperty({ minimum: 7, maximum: 400 })
  @IsInt()
  @Min(7)
  @Max(400)
  validityDays!: number;

  @ApiProperty({ minimum: 100 })
  @IsInt()
  @Min(100)
  pricePaise!: number;

  @ApiProperty({ type: PlanTextsDto })
  @ValidateNested()
  @Type(() => PlanTextsDto)
  texts!: PlanTextsDto;
}

export class PlanDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['package', 'subscription'] })
  kind!: string;

  @ApiProperty({ type: String, nullable: true })
  providerId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  providerName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  itemCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  service!: string | null;

  @ApiProperty()
  units!: number;

  @ApiProperty()
  discountPercent!: number;

  @ApiProperty({ type: String, nullable: true })
  period!: string | null;

  @ApiProperty()
  familyMembers!: number;

  @ApiProperty()
  validityDays!: number;

  @ApiProperty()
  pricePaise!: number;

  @ApiProperty({ enum: ['pending_approval', 'active', 'retired'] })
  status!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  inclusions!: string;

  @ApiProperty()
  exclusions!: string;
}

export class PlanQueryDto {
  @ApiPropertyOptional({ enum: SERVICES })
  @IsOptional()
  @IsIn(SERVICES)
  service?: string;

  @ApiPropertyOptional({ enum: LOCALES })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: (typeof LOCALES)[number];
}

export class EntitlementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  itemCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  service!: string | null;

  @ApiProperty()
  unitsTotal!: number;

  @ApiProperty()
  unitsUsed!: number;
}

export class PurchaseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  planId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['pending_payment', 'active', 'expired', 'cancelled'] })
  status!: string;

  @ApiProperty()
  autoRenew!: boolean;

  @ApiProperty()
  pricePaise!: number;

  @ApiProperty()
  paidPaise!: number;

  @ApiProperty()
  refundedPaise!: number;

  @ApiProperty({ type: Date, nullable: true })
  endsAt!: Date | null;

  @ApiProperty({ type: [EntitlementDto] })
  entitlements!: EntitlementDto[];

  @ApiProperty({ description: 'What cancelling now would refund, pro-rata (PK-07)' })
  refundIfCancelledPaise!: number;
}

export class PurchaseCheckoutDto {
  @ApiProperty({ format: 'uuid' })
  purchaseId!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  amountPaise!: number;

  @ApiProperty()
  sandbox!: boolean;
}

export class AutoRenewDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
