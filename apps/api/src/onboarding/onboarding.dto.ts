import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { NAME_PATTERN } from '../accounts/setup-rules.js';
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
const IDENTITY_STATES = ['not_started', 'pending', 'verified', 'failed'] as const;
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

export class ApplicationDto {
  @ApiProperty()
  role!: string;

  @ApiProperty({ enum: APPLICATION_STATUSES })
  status!: (typeof APPLICATION_STATUSES)[number];

  @ApiProperty({ type: String, nullable: true })
  statusReason!: string | null;

  @ApiProperty({ enum: IDENTITY_STATES })
  identity!: IdentityState;

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

export class IdentityStartDto {
  @ApiProperty({ enum: ['or', 'en', 'hi'], description: 'Language of the page to return to' })
  @IsIn(['or', 'en', 'hi'])
  locale!: 'or' | 'en' | 'hi';
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
}

export class ApplicationQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'decided'] })
  @IsOptional()
  @IsIn(['open', 'decided'])
  view?: 'open' | 'decided';
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
