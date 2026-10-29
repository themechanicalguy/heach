import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoleGrantDto } from '../accounts/accounts.dto.js';
import { ADMIN_ROLES } from '../common/request-context.js';

export const SUSPENSION_REASONS = [
  'safety_concern',
  'fraud',
  'policy_breach',
  'user_request',
  'other',
] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

export class AdminPasswordDto {
  @ApiProperty({ example: 'verifier@heach.invalid' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  password!: string;
}

export class AdminEnrolmentDto {
  @ApiProperty({ description: 'Base32 secret for the authenticator app; shown once' })
  secret!: string;

  @ApiProperty({ description: 'otpauth:// link with the same secret' })
  uri!: string;
}

export class AdminPasswordAcceptedDto {
  @ApiProperty({ description: 'Single-use ticket for the TOTP step, valid 5 minutes' })
  mfaTicket!: string;

  @ApiPropertyOptional({ type: AdminEnrolmentDto })
  enrolment?: AdminEnrolmentDto;

  @ApiProperty({ description: 'A temporary password: send a new one with the TOTP code (O-2)' })
  passwordChangeRequired!: boolean;
}

export class AdminMfaDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[\w-]{20,}$/)
  mfaTicket!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiPropertyOptional({ description: 'Required when the password is temporary (O-2)' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  newPassword?: string;
}

export class AdminCodeDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code!: string;
}

export class AdminMeDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ADMIN_ROLES })
  role!: string;
}

export class UserQueryDto {
  @ApiPropertyOptional({ description: 'A mobile number (exact) or part of a name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended'] })
  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export class UserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Masked' })
  name!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Last four digits only' })
  mobile!: string | null;

  @ApiProperty({ enum: ['active', 'suspended'] })
  status!: 'active' | 'suspended';

  @ApiProperty({ enum: SUSPENSION_REASONS, nullable: true, type: String })
  suspensionReason!: string | null;

  @ApiProperty({ type: [RoleGrantDto] })
  roles!: RoleGrantDto[];

  @ApiProperty()
  setupComplete!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastSignInAt!: string | null;
}

export class UserDetailDto extends UserSummaryDto {
  @ApiProperty({ nullable: true, type: String, description: 'Full name; this read is audited' })
  fullName!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  deletionRequestedAt!: string | null;
}

export class UserPageDto {
  @ApiProperty({ type: [UserSummaryDto] })
  items!: UserSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class SuspendDto {
  @ApiProperty({ enum: SUSPENSION_REASONS })
  @IsIn(SUSPENSION_REASONS)
  reason!: SuspensionReason;
}

/** An admin's own password change: the current one, a new one and a fresh TOTP before (O-2). */
export class AdminPasswordChangeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  currentPassword!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MaxLength(400)
  newPassword!: string;
}

export class AdminSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ADMIN_ROLES }) role!: string;
  @ApiProperty({ enum: ['active', 'disabled'] }) status!: 'active' | 'disabled';
  @ApiProperty() mfaEnrolled!: boolean;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty() locked!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) lastSignInAt!: string | null;
}

export class NewAdminDto {
  @ApiProperty({ example: 'support@heach.invalid' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: ADMIN_ROLES })
  @IsIn(ADMIN_ROLES)
  role!: (typeof ADMIN_ROLES)[number];
}

export class AdminRoleDto {
  @ApiProperty({ enum: ADMIN_ROLES })
  @IsIn(ADMIN_ROLES)
  role!: (typeof ADMIN_ROLES)[number];
}

export class AdminStatusDto {
  @ApiProperty({ enum: ['active', 'disabled'] })
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}

export class TemporaryPasswordDto {
  @ApiProperty({ description: 'Shown once; expires in 24 hours; changed at the next sign-in' })
  temporaryPassword!: string;
}

export class CreatedAdminDto extends TemporaryPasswordDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
}
