import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { UploadDto } from '../onboarding/onboarding.dto.js';

export const RECORD_TYPES = [
  'prescription',
  'lab_report',
  'scan',
  'discharge_summary',
  'vaccination',
  'visit_note',
  'other',
] as const;
export const HISTORY_KINDS = [
  'allergy',
  'condition',
  'medicine',
  'surgery',
  'blood_group',
  'vaccination',
  'family_history',
] as const;

export class VisitNotesViewDto {
  @ApiProperty()
  procedure!: string;

  @ApiProperty()
  observations!: string;

  @ApiProperty()
  advice!: string;
}

export class RecordDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Linked patient; null for the account holder',
  })
  personId!: string | null;

  @ApiProperty({
    enum: ['patient', 'visit', 'lab', 'provider'],
    description: 'Added by the patient, or issued on the application (MV-04)',
  })
  source!: string;

  @ApiProperty({ enum: RECORD_TYPES })
  recordType!: string;

  @ApiProperty({ format: 'date' })
  recordDate!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  facility!: string | null;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: VisitNotesViewDto, nullable: true })
  visitNotes!: VisitNotesViewDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Provider who issued it' })
  issuedBy!: string | null;

  @ApiProperty()
  hasFile!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class RecordInputDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'A linked patient; the account holder when absent',
  })
  @IsOptional()
  @IsUUID('4')
  personId?: string;

  @ApiProperty({ enum: RECORD_TYPES })
  @IsIn(RECORD_TYPES)
  recordType!: (typeof RECORD_TYPES)[number];

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true })
  @Length(10, 10)
  recordDate!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  facility?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^[\p{L}\p{M}\p{N} _-]{1,30}$/u, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiPropertyOptional({ type: UploadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UploadDto)
  file?: UploadDto;
}

export class VaultQueryDto {
  @ApiPropertyOptional({ description: 'A linked patient ID, or `self`' })
  @IsOptional()
  @Matches(/^(self|[0-9a-f-]{36})$/)
  person?: string;

  @ApiPropertyOptional({ enum: RECORD_TYPES })
  @IsOptional()
  @IsIn(RECORD_TYPES)
  type?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ description: 'Search titles, tags and provider names (MV-06)' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  q?: string;
}

export class HistoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  personId!: string | null;

  @ApiProperty({ enum: HISTORY_KINDS })
  kind!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ description: 'Who added it (MV-05)' })
  addedByRole!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class HistoryInputDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  personId?: string;

  @ApiProperty({ enum: HISTORY_KINDS })
  @IsIn(HISTORY_KINDS)
  kind!: (typeof HISTORY_KINDS)[number];

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @Length(1, 300)
  text!: string;
}

export class ShareInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  bookingId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  recordIds!: string[];

  @ApiProperty()
  @IsBoolean()
  includeHistory!: boolean;
}

export class ShareDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty({ type: [String] })
  recordIds!: string[];

  @ApiProperty()
  includeHistory!: boolean;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  revokedAt!: Date | null;
}

export class LinkInputDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  recordIds!: string[];

  @ApiProperty({ minimum: 1, maximum: 72, description: 'Hours until the link expires' })
  @IsInt()
  @Min(1)
  @Max(72)
  hours!: number;
}

export class LinkCreatedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Part of the link; shown once' })
  token!: string;

  @ApiProperty({ description: 'The one-time code the doctor needs; shown once' })
  code!: string;

  @ApiProperty()
  expiresAt!: Date;
}

export class LinkDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  records!: number;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  revokedAt!: Date | null;
}

export class LinkOpenDto {
  @ApiProperty()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class SharedFileDto {
  @ApiProperty({ format: 'uuid' })
  recordId!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  contentBase64!: string;
}

export class SharedRecordsDto {
  @ApiProperty({ type: [RecordDto] })
  records!: RecordDto[];

  @ApiProperty({ type: [HistoryEntryDto] })
  history!: HistoryEntryDto[];

  @ApiProperty({ type: [SharedFileDto], description: 'Files, for an external link only' })
  files!: SharedFileDto[];
}

export class AccessDto {
  @ApiProperty()
  accessorRole!: string;

  @ApiProperty({ type: String, nullable: true })
  accessorName!: string | null;

  @ApiProperty({ enum: ['booking_share', 'external_link'] })
  via!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class UsageDto {
  @ApiProperty()
  usedBytes!: number;

  @ApiProperty()
  quotaBytes!: number;

  @ApiProperty({ description: 'Warn the user: above 80 % of the quota (MV-15)' })
  nearlyFull!: boolean;
}

export class VaultStatsDto {
  @ApiProperty()
  records!: number;

  @ApiProperty()
  storageBytes!: number;

  @ApiProperty()
  infectedUploads!: number;

  @ApiProperty()
  activeShares!: number;

  @ApiProperty()
  activeLinks!: number;

  @ApiProperty()
  openDeletionRequests!: number;
}

export class ProviderRecordInputDto {
  @ApiProperty({ enum: RECORD_TYPES })
  @IsIn(RECORD_TYPES)
  recordType!: (typeof RECORD_TYPES)[number];

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiPropertyOptional({ type: UploadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UploadDto)
  file?: UploadDto;
}

/** What a breach containment revoked (SO-09). */
export class RevokedSharesDto {
  @ApiProperty()
  shares!: number;

  @ApiProperty()
  links!: number;
}
