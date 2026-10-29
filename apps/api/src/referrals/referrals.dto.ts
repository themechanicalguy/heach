import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

export class CouponDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  valuePaise!: number;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ enum: ['active', 'used', 'cancelled'] })
  status!: string;
}

export class InviteeDto {
  @ApiProperty({
    enum: ['joined', 'rewarded', 'flagged', 'rejected'],
    description: 'No health or booking detail (RR-07)',
  })
  status!: string;

  @ApiProperty()
  joinedAt!: Date;
}

export class ReferralDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({ type: [InviteeDto] })
  invitees!: InviteeDto[];

  @ApiProperty({ type: [CouponDto] })
  coupons!: CouponDto[];

  @ApiProperty({ description: 'This account joined with someone’s code' })
  invited!: boolean;
}

export class JoinDto {
  @ApiProperty()
  @Matches(/^[A-Z0-9]{8}$/)
  code!: string;
}

export class AdminReferralDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  flagReason!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ReferralQueryDto {
  @ApiPropertyOptional({ enum: ['joined', 'rewarded', 'flagged', 'rejected'] })
  @IsOptional()
  @IsIn(['joined', 'rewarded', 'flagged', 'rejected'])
  status?: string;
}
