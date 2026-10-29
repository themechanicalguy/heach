import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { SETTING_KEYS, type SettingKey } from '../settings/settings.service.js';

export class SettingDto {
  @ApiProperty({ enum: SETTING_KEYS })
  key!: string;

  @ApiProperty()
  value!: number;
}

export class SettingInputDto {
  @ApiProperty({ enum: SETTING_KEYS })
  @IsIn(SETTING_KEYS)
  key!: SettingKey;

  @ApiProperty({ minimum: 0, maximum: 1_000_000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  value!: number;
}

export class CountDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  count!: number;
}

export class DashboardDto {
  @ApiProperty()
  signUps!: number;

  @ApiProperty({ type: [CountDto], description: 'Verified providers by role' })
  providersByRole!: CountDto[];

  @ApiProperty({ type: [CountDto], description: 'Verified providers by district served' })
  providersByDistrict!: CountDto[];

  @ApiProperty({ type: [CountDto], description: 'Bookings by service' })
  bookingsByService!: CountDto[];

  @ApiProperty({ type: [CountDto], description: 'Bookings by status' })
  bookingsByStatus!: CountDto[];

  @ApiProperty()
  completionRate!: number;

  @ApiProperty()
  cancellationRate!: number;

  @ApiProperty({ description: 'Commission on completed bookings and plan sales, in paise' })
  revenuePaise!: number;
}

export class BreakGlassEntryDto {
  @ApiProperty()
  adminRole!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  grantedAt!: Date;

  @ApiProperty()
  expiresAt!: Date;
}

export class SecurityDto {
  @ApiProperty({ type: [BreakGlassEntryDto] })
  breakGlass!: BreakGlassEntryDto[];

  @ApiProperty({ description: 'Provider strike reviews still open (A12)' })
  openStrikeReviews!: number;

  @ApiProperty({ description: 'Referrals held for review (RR-06)' })
  flaggedReferrals!: number;

  @ApiProperty({ description: 'Uploads quarantined by the scanner' })
  infectedUploads!: number;

  @ApiProperty({
    description: 'Records read through shares in the last 24 hours (unusual-read watch)',
  })
  recordReads24h!: number;
}
