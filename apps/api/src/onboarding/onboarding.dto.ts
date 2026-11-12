import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NAME_PATTERN } from '../accounts/setup-rules.js';
import { ONBOARDING_ROLES, type OnboardingRole } from './checklists.js';
import { UPLOAD_TYPES, type UploadType } from '../uploads/upload-rules.js';

const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
] as const;
// `in_review`: a fallback document is waiting for a verifier (KY-07).
const IDENTITY_STATES = ['not_started', 'pending', 'in_review', 'verified', 'failed'] as const;
const IDENTITY_METHODS = ['aadhaar', 'digilocker', 'manual'] as const;
export type IdentityMethod = (typeof IDENTITY_METHODS)[number];
// Never an Aadhaar card: its copy would carry the full number (PR-03).
export const IDENTITY_DOCUMENT_KINDS = [
  'voter_id',
  'passport',
  'driving_licence',
  'pan_card',
] as const;
export type IdentityDocumentKind = (typeof IDENTITY_DOCUMENT_KINDS)[number];
const LOCALES = ['or', 'en', 'hi'] as const;
export type IdentityState = (typeof IDENTITY_STATES)[number];
// Base64 of at most 5 MB, the upload limit (EN-07).
const MAX_BASE64 = 7_000_000;

/** A file sent as base64 JSON with the upload content type (EN-07). */
export class UploadDto {
  @ApiProperty({ enum: UPLOAD_TYPES })
  @IsIn(UPLOAD_TYPES)
  contentType!: UploadType;

  @ApiProperty({ description: 'The file, base64 encoded; at most 5 MB decoded' })
  @IsBase64()
  @MaxLength(MAX_BASE64)
  contentBase64!: string;
}

export class DocumentUploadDto extends UploadDto {
  @ApiPropertyOptional({ maxLength: 60, description: 'Registration or certificate number' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/ .-]{0,59}$/)
  reference?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Length(10, 10)
  expiresOn?: string;
}

export class DocumentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['pending', 'clean', 'infected'] })
  scanStatus!: 'pending' | 'clean' | 'infected';

  @ApiProperty({ type: String, nullable: true })
  reference!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date' })
  expiresOn!: string | null;

  @ApiProperty({ enum: ['pending', 'accepted', 'rejected'] })
  reviewStatus!: 'pending' | 'accepted' | 'rejected';

  @ApiProperty({ type: String, nullable: true })
  reviewReason!: string | null;

  @ApiProperty()
  uploadedAt!: Date;

  @ApiProperty({
    enum: ['upload', 'digilocker'],
    description: 'An issued copy or an upload (KY-02)',
  })
  source!: 'upload' | 'digilocker';

  @ApiProperty({ type: String, nullable: true, description: 'Who issued a DigiLocker copy' })
  issuer!: string | null;
}

export class ChecklistEntryDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ description: 'A registration or certificate number is needed' })
  reference!: boolean;

  @ApiProperty({ description: 'The document has an expiry date' })
  expiry!: boolean;

  @ApiProperty({ type: DocumentDto, nullable: true })
  document!: DocumentDto | null;
}

export class PayoutSummaryDto {
  @ApiProperty({ enum: ['bank', 'upi'] })
  method!: 'bank' | 'upi';

  @ApiProperty()
  holderName!: string;

  @ApiProperty({ description: 'Last four characters of the account number or UPI ID' })
  hint!: string;
}

/** What the public profile shows beyond the account details (PO-05). */
export class ProviderProfileDetailsDto {
  @ApiProperty({ type: String, nullable: true })
  qualifications!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  experienceYears!: number | null;

  @ApiProperty()
  hasPhoto!: boolean;

  @ApiProperty({ description: 'The photo came from the identity check and is locked (KY-03)' })
  photoVerified!: boolean;
}

export class ProviderProfileInputDto {
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  qualifications?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;
}

export class ApplicationDto {
  @ApiProperty()
  role!: string;

  @ApiProperty({ enum: APPLICATION_STATUSES })
  status!: (typeof APPLICATION_STATUSES)[number];

  @ApiProperty({ type: String, nullable: true })
  statusReason!: string | null;

  @ApiProperty({ enum: IDENTITY_STATES })
  identity!: IdentityState;

  @ApiProperty({
    enum: IDENTITY_METHODS,
    nullable: true,
    description: 'How it was checked (KY-09)',
  })
  identityMethod!: IdentityMethod | null;

  @ApiProperty({ enum: IDENTITY_DOCUMENT_KINDS, nullable: true })
  identityDocumentKind!: IdentityDocumentKind | null;

  @ApiProperty({ description: 'Version of the identity consent text in force (PR-01)' })
  identityConsentVersion!: string;

  @ApiProperty({
    enum: ['match', 'mismatch'],
    nullable: true,
    description: 'Whether the name typed at sign-up agreed with the verified name (KY-04)',
  })
  identityNameMatch!: 'match' | 'mismatch' | null;

  @ApiProperty({
    description: 'Name and gender came from the identity check and are locked (KY-03)',
  })
  identityDetailsVerified!: boolean;

  @ApiProperty({ type: ProviderProfileDetailsDto })
  profile!: ProviderProfileDetailsDto;

  @ApiProperty()
  needsPayout!: boolean;

  @ApiProperty({ type: PayoutSummaryDto, nullable: true })
  payout!: PayoutSummaryDto | null;

  @ApiProperty({ type: [ChecklistEntryDto] })
  items!: ChecklistEntryDto[];

  @ApiProperty({ type: [String], description: 'What still stops submission' })
  missing!: string[];

  @ApiProperty({ description: 'The application may be changed now' })
  editable!: boolean;
}

const CONSENT_VERSION = /^[a-z0-9.-]{1,40}$/;

export class IdentityStartDto {
  @ApiProperty({ enum: LOCALES, description: 'Language of the page to return to' })
  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  @ApiProperty({ description: 'Version of the consent text the provider agreed to (PR-01)' })
  @Matches(CONSENT_VERSION)
  consentVersion!: string;
}

/** The fallback identity document (KY-07), sent with the upload content type. */
export class IdentityDocumentDto extends UploadDto {
  @ApiProperty({ enum: IDENTITY_DOCUMENT_KINDS })
  @IsIn(IDENTITY_DOCUMENT_KINDS)
  kind!: IdentityDocumentKind;

  @ApiProperty({ enum: LOCALES, description: 'Language the consent text was read in' })
  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  @ApiProperty({ description: 'Version of the consent text the provider agreed to (PR-01)' })
  @Matches(CONSENT_VERSION)
  consentVersion!: string;
}

/** The provider's own verified details that are not on the profile (KY-03). Restricted. */
export class IdentityDetailsDto {
  @ApiProperty({ format: 'date' })
  dateOfBirth!: string;

  @ApiProperty()
  address!: string;
}

export class IdentityRedirectDto {
  @ApiProperty()
  redirectUrl!: string;
}

export class IdentityCompleteDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Length(1, 200)
  code!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @Matches(/^[\w-]{8,80}$/)
  reference!: string;
}

export class PayoutDetailsDto {
  @ApiProperty({ enum: ['bank', 'upi'] })
  @IsIn(['bank', 'upi'])
  method!: 'bank' | 'upi';

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(1, 100)
  @Matches(NAME_PATTERN)
  holderName!: string;

  @ApiPropertyOptional({ description: 'Bank account number, 9 to 18 digits' })
  @ValidateIf((body: PayoutDetailsDto) => body.method === 'bank')
  @Matches(/^\d{9,18}$/)
  accountNumber?: string;

  @ApiPropertyOptional({ description: 'IFSC of the branch' })
  @ValidateIf((body: PayoutDetailsDto) => body.method === 'bank')
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
  ifsc?: string;

  @ApiPropertyOptional({ description: 'UPI ID, for example name@bank' })
  @ValidateIf((body: PayoutDetailsDto) => body.method === 'upi')
  @Matches(/^[\w.-]{2,64}@[A-Za-z]{2,32}$/)
  upiId?: string;
}

/** Admin's view (AD-02). */
export class ApplicationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ enum: APPLICATION_STATUSES })
  status!: (typeof APPLICATION_STATUSES)[number];

  @ApiProperty({ type: String, nullable: true })
  fullName!: string | null;

  @ApiProperty({ type: Date, nullable: true })
  submittedAt!: Date | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Whole days since the application was submitted (AD-02)',
  })
  ageDays!: number | null;

  @ApiProperty({ description: 'An admin set this application up with the provider (AD-12)' })
  assisted!: boolean;

  @ApiProperty({ description: 'The calling admin assisted it and may not review it (AD-12)' })
  assistedByYou!: boolean;
}

export class ApplicationEventDto {
  @ApiProperty()
  fromStatus!: string;

  @ApiProperty()
  toStatus!: string;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty()
  actorRole!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class ApplicationReviewDto extends ApplicationDto {
  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({ type: String, nullable: true })
  fullName!: string | null;

  @ApiProperty({ type: [ApplicationEventDto] })
  history!: ApplicationEventDto[];

  @ApiProperty({ description: 'An admin set this application up with the provider (AD-12)' })
  assisted!: boolean;

  @ApiProperty({ description: 'Identity consent was read aloud in an assisted session (KY-01)' })
  identityConsentAssisted!: boolean;

  @ApiProperty({ description: 'The provider has not yet accepted the current terms or privacy' })
  providerConsentDue!: boolean;
}

export const AGE_BUCKETS = ['lt1', '1to3', 'gt3'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** Whole digits only; anything else stays a string so validation refuses it. */
const toWholeNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d{1,3}$/.test(value) ? Number(value) : value;

export class ApplicationQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'decided'] })
  @IsOptional()
  @IsIn(['open', 'decided'])
  view?: 'open' | 'decided';

  @ApiPropertyOptional({ enum: ONBOARDING_ROLES, description: 'Only this provider type' })
  @IsOptional()
  @IsIn(ONBOARDING_ROLES)
  role?: OnboardingRole;

  @ApiPropertyOptional({
    enum: AGE_BUCKETS,
    description: 'Days since submission: under 1, from 1 to under 3, or 3 and more',
  })
  @IsOptional()
  @IsIn(AGE_BUCKETS)
  age?: AgeBucket;

  @ApiPropertyOptional({ minimum: 0, maximum: 365, description: 'At least this many days old' })
  @IsOptional()
  @Transform(toWholeNumber)
  @IsInt()
  @Min(0)
  @Max(365)
  minAgeDays?: number;
}

export class DocumentReviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  @Matches(/^[0-9a-f-]{36}$/)
  documentId!: string;

  @ApiProperty({ enum: ['accepted', 'rejected'] })
  @IsIn(['accepted', 'rejected'])
  status!: 'accepted' | 'rejected';

  @ApiPropertyOptional({ description: 'Required when rejected' })
  @ValidateIf((body: DocumentReviewDto) => body.status === 'rejected')
  @Matches(/^[a-z_]{1,40}$/)
  reason?: string;
}

export class IdentityReviewDto {
  @ApiProperty({ enum: ['accepted', 'rejected'] })
  @IsIn(['accepted', 'rejected'])
  status!: 'accepted' | 'rejected';
}

export const DECISION_REASONS = [
  'documents_unclear',
  'documents_expired',
  'identity_mismatch',
  'qualification_not_recognised',
  'police_verification_failed',
  'other',
] as const;

export class DecisionDto {
  @ApiProperty({ enum: ['approve', 'reject', 'request_changes'] })
  @IsIn(['approve', 'reject', 'request_changes'])
  decision!: 'approve' | 'reject' | 'request_changes';

  @ApiPropertyOptional({ enum: DECISION_REASONS, description: 'Required unless approving' })
  @ValidateIf((body: DecisionDto) => body.decision !== 'approve')
  @IsIn(DECISION_REASONS)
  reason?: (typeof DECISION_REASONS)[number];
}

export class StoredFileDto {
  @ApiProperty({ enum: UPLOAD_TYPES })
  contentType!: string;

  @ApiProperty()
  contentBase64!: string;
}
