import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LOCALES, type Locale } from '@heach/i18n';
import { GRANTED_USER_ROLES, USER_ROLES } from '../common/request-context.js';
import { LinkedPatientDto } from '../linked-patients/linked-patients.dto.js';
import { MembershipDto } from '../organisations/organisations.dto.js';
import { CONSENT_PURPOSES, type ConsentPurpose } from './consent-versions.js';
import {
  GENDERS,
  type Gender,
  NAME_PATTERN,
  type RegistrableRole,
  SELF_REGISTRABLE_ROLES,
  type SetupRole,
  STAFF_ROLES,
} from './setup-rules.js';

const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
] as const;

const ORGANISATION_NAME = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,&'()-]*$/u;

export class OtpRequestDto {
  @ApiProperty({ description: 'Indian mobile number, with or without +91', example: '9000000001' })
  @IsString()
  @MaxLength(20)
  mobile!: string;

  @ApiProperty({ enum: LOCALES, description: 'Language of the SMS and of a new account' })
  @IsIn(LOCALES)
  locale!: Locale;
}

export class OtpResendDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ enum: LOCALES })
  @IsIn(LOCALES)
  locale!: Locale;
}

export class OtpVerifyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ enum: LOCALES })
  @IsIn(LOCALES)
  locale!: Locale;
}

export class OtpChallengeDto {
  @ApiProperty({ format: 'uuid' })
  challengeId!: string;

  @ApiProperty({ description: 'Seconds until the code expires' })
  expiresInSeconds!: number;

  @ApiProperty({ description: 'Seconds until a new code may be requested' })
  resendInSeconds!: number;
}

export class ReverifyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code!: string;
}

export class SwitchRoleDto {
  @ApiProperty({ enum: GRANTED_USER_ROLES })
  @IsIn(GRANTED_USER_ROLES)
  role!: (typeof GRANTED_USER_ROLES)[number];
}

export class LocaleDto {
  @ApiProperty({ enum: LOCALES })
  @IsIn(LOCALES)
  locale!: Locale;
}

/** One setup save; absent fields keep their saved value (PO-03). */
export class SetupPatchDto {
  @ApiPropertyOptional({ enum: SELF_REGISTRABLE_ROLES })
  @IsOptional()
  @IsIn(SELF_REGISTRABLE_ROLES)
  role?: RegistrableRole;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(NAME_PATTERN)
  fullName?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @ApiPropertyOptional({ enum: LOCALES, isArray: true, description: 'Languages spoken' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(LOCALES.length)
  @IsIn(LOCALES, { each: true })
  languages?: Locale[];

  @ApiPropertyOptional({ maxLength: 120, description: "The lab's name (labs only)" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,&'()-]*$/u)
  organisationName?: string;

  @ApiPropertyOptional({ description: 'The person confirms they are 18 or older' })
  @IsOptional()
  @IsBoolean()
  adultDeclared?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'An open staff invitation to accept instead of choosing a role (O-1)',
  })
  @IsOptional()
  @IsUUID('4')
  invitationId?: string;
}

export class ConsentDto {
  @ApiProperty({ enum: CONSENT_PURPOSES })
  @IsIn(CONSENT_PURPOSES)
  purpose!: ConsentPurpose;

  @ApiProperty({ example: '2026-10-draft.1' })
  @Matches(/^[a-z0-9.-]{1,40}$/)
  version!: string;
}

export class ConsentsDto {
  @ApiProperty({ type: [ConsentDto] })
  @IsArray()
  @ArrayMaxSize(CONSENT_PURPOSES.length)
  @ValidateNested({ each: true })
  @Type(() => ConsentDto)
  consents!: ConsentDto[];
}

/** Adds the other side to an account (decision L-3); needs a fresh OTP. */
export class AddRoleDto {
  @ApiProperty({ enum: SELF_REGISTRABLE_ROLES })
  @IsIn(SELF_REGISTRABLE_ROLES)
  role!: RegistrableRole;

  @ApiPropertyOptional({ enum: LOCALES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(LOCALES.length)
  @IsIn(LOCALES, { each: true })
  languages?: Locale[];

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,&'()-]*$/u)
  organisationName?: string;
}

export class RoleGrantDto {
  @ApiProperty({ enum: GRANTED_USER_ROLES })
  role!: string;

  @ApiProperty({ enum: ['care', 'provider'] })
  side!: 'care' | 'provider';

  @ApiProperty({ enum: APPLICATION_STATUSES, nullable: true, type: String })
  applicationStatus!: (typeof APPLICATION_STATUSES)[number] | null;

  @ApiProperty({ nullable: true, type: String, description: 'Reason code, never free text' })
  statusReason!: string | null;
}

/** A grant as its holder and admins see it: kept even while its role is deferred (ADR 0015). */
export class HeldRoleDto extends RoleGrantDto {
  @ApiProperty({
    description:
      'False while the role is deferred beyond the MVP (flag doctor-and-clinic off): kept, but it cannot be signed in to or switched to',
  })
  available!: boolean;
}

export class SetupDraftDto {
  @ApiProperty({ enum: [...SELF_REGISTRABLE_ROLES, ...STAFF_ROLES], nullable: true, type: String })
  role!: SetupRole | null;

  @ApiProperty({ nullable: true, type: String })
  fullName!: string | null;

  @ApiProperty({ enum: GENDERS, nullable: true, type: String })
  gender!: Gender | null;

  @ApiProperty({ enum: LOCALES, isArray: true })
  languages!: string[];

  @ApiProperty({ nullable: true, type: String })
  organisationName!: string | null;

  @ApiProperty()
  adultDeclared!: boolean;
}

export class SetupStateDto {
  @ApiProperty()
  complete!: boolean;

  @ApiProperty({ enum: ['role', 'details', 'consent'], nullable: true, type: String })
  nextStep!: 'role' | 'details' | 'consent' | null;

  @ApiProperty({ type: SetupDraftDto })
  draft!: SetupDraftDto;
}

export class MeDto {
  @ApiProperty({ enum: LOCALES })
  locale!: Locale;

  @ApiProperty({ nullable: true, type: String, description: 'Last four digits only' })
  mobile!: string | null;

  @ApiProperty({ enum: USER_ROLES, description: 'The role this session acts in' })
  activeRole!: string;

  @ApiProperty({ type: [HeldRoleDto] })
  roles!: HeldRoleDto[];

  @ApiProperty({
    enum: SELF_REGISTRABLE_ROLES,
    isArray: true,
    description: 'Roles setup and adding a role accept now; deferred roles are left out (ADR 0015)',
  })
  offeredRoles!: RegistrableRole[];

  @ApiProperty({ type: SetupStateDto })
  setup!: SetupStateDto;

  @ApiProperty({ type: [ConsentDto], description: 'Current consent versions not yet given' })
  consentsDue!: ConsentDto[];

  @ApiProperty({ type: MembershipDto, nullable: true, description: 'Active staff membership' })
  membership!: MembershipDto | null;

  @ApiProperty({ description: 'Open staff invitations addressed to this number' })
  invitations!: number;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  deletionRequestedAt!: string | null;
}

/** Corrects basic details after setup (AC-06); absent fields keep their value. */
export class ProfileCorrectionDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(NAME_PATTERN)
  fullName?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @ApiPropertyOptional({ enum: LOCALES, isArray: true, description: 'Languages spoken' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(LOCALES.length)
  @IsIn(LOCALES, { each: true })
  languages?: Locale[];

  @ApiPropertyOptional({ maxLength: 120, description: "The lab's name (labs only)" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(ORGANISATION_NAME)
  organisationName?: string;
}

/** The new number for the account (O-3); a code goes to it. */
export class MobileChangeDto {
  @ApiProperty({ description: 'Indian mobile number, with or without +91', example: '9000000003' })
  @IsString()
  @MaxLength(20)
  mobile!: string;
}

export class ExportConsentDto {
  @ApiProperty() purpose!: string;
  @ApiProperty() version!: string;
  @ApiProperty() locale!: string;
  @ApiProperty({ format: 'date-time' }) givenAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) withdrawnAt!: string | null;
}

/** Everything the account holds about its owner, as a download (PR-04, default D-4). */
export class AccountExportDto {
  @ApiProperty({ format: 'date-time' }) exportedAt!: string;
  @ApiProperty({ description: "The full number: this is the owner's own data" }) mobile!: string;
  @ApiProperty({ enum: LOCALES }) locale!: Locale;
  @ApiProperty({ type: SetupDraftDto }) profile!: SetupDraftDto;
  @ApiProperty({ type: [RoleGrantDto] }) roles!: RoleGrantDto[];
  @ApiProperty({ type: [ExportConsentDto] }) consents!: ExportConsentDto[];
  @ApiProperty({ type: MembershipDto, nullable: true }) membership!: MembershipDto | null;
  @ApiProperty({ type: [LinkedPatientDto] }) linkedPatients!: LinkedPatientDto[];
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  deletionRequestedAt!: string | null;
}
