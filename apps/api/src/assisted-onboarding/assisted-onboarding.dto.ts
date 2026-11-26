import { LOCALES, type Locale } from '@heach/i18n';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { GENDERS, type Gender, NAME_PATTERN } from '../accounts/setup-rules.js';
import {
  IdentityDocumentDto,
  type IdentityState,
  PayoutDetailsDto,
  ProviderProfileDetailsDto,
  type ApplicationDto,
} from '../onboarding/onboarding.dto.js';
import { ASSISTED_ROLES, type AssistedRole } from './assisted-rules.js';

const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
] as const;
const IDENTITY_STATES = ['not_started', 'pending', 'in_review', 'verified', 'failed'] as const;

export class AssistedConsentRequestDto {
  @ApiProperty({ description: 'The provider’s Indian mobile number, with or without +91' })
  @IsString()
  @MaxLength(20)
  mobile!: string;

  @ApiProperty({ enum: LOCALES, description: 'Language of the SMS and of a new account' })
  @IsIn(LOCALES)
  locale!: Locale;
}

export class AssistedCodeDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code!: string;
}

export class AssistedChallengeDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ description: 'The provider’s number, last four digits only' })
  mobile!: string;

  @ApiProperty({ description: 'Seconds until the code expires' })
  expiresInSeconds!: number;

  @ApiProperty({ description: 'Seconds until a new code may be requested' })
  resendInSeconds!: number;
}

/** The provider's basic details and provider type, as the admin enters them (AD-12). */
export class AssistedDetailsDto {
  @ApiProperty({ enum: ASSISTED_ROLES })
  @IsIn(ASSISTED_ROLES)
  role!: AssistedRole;

  @ApiPropertyOptional({ maxLength: 100, description: 'Not accepted once setup is complete' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(NAME_PATTERN)
  fullName?: string;

  @ApiPropertyOptional({ enum: GENDERS, description: 'Not accepted once setup is complete' })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @ApiProperty({ enum: LOCALES, isArray: true, description: 'Languages the provider speaks' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LOCALES.length)
  @ArrayUnique()
  @IsIn(LOCALES, { each: true })
  languages!: Locale[];

  @ApiPropertyOptional({ maxLength: 120, description: "The lab's name (labs only)" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,&'()-]*$/u)
  organisationName?: string;

  @ApiPropertyOptional({ description: 'The provider confirmed they are 18 or older' })
  @IsOptional()
  @IsBoolean()
  adultDeclared?: boolean;
}

/** The fallback identity document, with the admin's confirmation that the consent was read out. */
export class AssistedIdentityDocumentDto extends IdentityDocumentDto {
  @ApiProperty({ enum: [true], description: 'The consent text was read to the provider (PR-01)' })
  @IsIn([true])
  consentReadAloud!: true;
}

export class AssistedPayoutDto extends PayoutDetailsDto {
  @ApiProperty({ example: '123456', description: 'The code the provider read out for this save' })
  @Matches(/^\d{6}$/)
  code!: string;
}

export class AssistedPayoutChallengeDto {
  @ApiProperty({ description: 'The provider’s number, last four digits only' })
  mobile!: string;

  @ApiProperty({ description: 'Seconds until the code expires' })
  expiresInSeconds!: number;

  @ApiProperty({ description: 'Seconds until a new code may be requested' })
  resendInSeconds!: number;
}

/** A document as the assisting admin sees it: state only, never a number, date or file (AD-12). */
export class AssistedDocumentDto {
  @ApiProperty({ enum: ['pending', 'clean', 'infected'] })
  scanStatus!: ApplicationDtoDocument['scanStatus'];

  @ApiProperty({ enum: ['pending', 'accepted', 'rejected'] })
  reviewStatus!: ApplicationDtoDocument['reviewStatus'];

  @ApiProperty({ type: String, nullable: true })
  reviewReason!: string | null;

  @ApiProperty()
  uploadedAt!: Date;

  @ApiProperty({ enum: ['upload', 'digilocker'] })
  source!: ApplicationDtoDocument['source'];
}

type ApplicationDtoDocument = NonNullable<ApplicationDto['items'][number]['document']>;

export class AssistedChecklistEntryDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ description: 'A registration or certificate number is needed' })
  reference!: boolean;

  @ApiProperty({ description: 'The document has an expiry date' })
  expiry!: boolean;

  @ApiProperty({ type: AssistedDocumentDto, nullable: true })
  document!: AssistedDocumentDto | null;
}

export class AssistedApplicationDto {
  @ApiProperty()
  role!: string;

  @ApiProperty({ enum: APPLICATION_STATUSES })
  status!: ApplicationDto['status'];

  @ApiProperty({ type: String, nullable: true })
  statusReason!: string | null;

  @ApiProperty({ enum: IDENTITY_STATES })
  identity!: IdentityState;

  @ApiProperty({ description: 'Version of the identity consent text in force (PR-01)' })
  identityConsentVersion!: string;

  @ApiProperty({ type: ProviderProfileDetailsDto })
  profile!: ProviderProfileDetailsDto;

  @ApiProperty()
  needsPayout!: boolean;

  @ApiProperty({ description: 'Payout details are on file; they are never shown' })
  payoutOnFile!: boolean;

  @ApiProperty({ type: [AssistedChecklistEntryDto] })
  items!: AssistedChecklistEntryDto[];

  @ApiProperty({ type: [String], description: 'What still stops submission' })
  missing!: string[];

  @ApiProperty({ description: 'The application may be changed now' })
  editable!: boolean;
}

export class AssistedSessionDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ description: 'The provider’s number, last four digits only' })
  mobile!: string;

  @ApiProperty({ type: String, nullable: true, description: 'First letter of each name word' })
  maskedName!: string | null;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  ended!: boolean;

  @ApiProperty({ description: 'The consent code created this account' })
  accountCreated!: boolean;

  @ApiProperty()
  setupComplete!: boolean;

  @ApiProperty({ description: 'Name, gender and adult declaration are set and cannot be changed' })
  basicDetailsLocked!: boolean;

  @ApiProperty({ description: 'A payout code is waiting to be used' })
  payoutCodeSent!: boolean;

  @ApiProperty({ type: AssistedApplicationDto, nullable: true })
  application!: AssistedApplicationDto | null;
}
