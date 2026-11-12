import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export const SEARCH_DEFAULT_LIMIT = 50;
export const SEARCH_MAX_LIMIT = 200;

/** The filters shared by the audit search and export (AD-11). All optional; all exact except `action`. */
export class AuditFilterDto {
  @ApiPropertyOptional({ description: 'Actor ID, exact' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  actorId?: string;

  @ApiPropertyOptional({ description: 'Actor role, exact, for example `verifier`' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  actorRole?: string;

  @ApiPropertyOptional({ description: 'Action prefix, matched literally, for example `admin.`' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  action?: string;

  @ApiPropertyOptional({ description: 'Entity type, exact' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  entity?: string;

  @ApiPropertyOptional({ description: 'Entity ID, exact' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  entityId?: string;

  @ApiPropertyOptional({ description: 'Earliest time, inclusive (ISO 8601 date-time)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ description: 'Latest time, inclusive (ISO 8601 date-time)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

export class AuditSearchQueryDto extends AuditFilterDto {
  @ApiPropertyOptional({ description: 'Cursor: only entries with a lower seq (a `nextBefore`)' })
  @IsOptional()
  @Matches(/^[1-9]\d{0,17}$/)
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: SEARCH_MAX_LIMIT, default: SEARCH_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SEARCH_MAX_LIMIT)
  limit?: number;
}

export class AuditEntryDto {
  @ApiProperty({ description: 'Position in the log, a bigint as a string' })
  seq!: string;

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  at!: string;

  @ApiProperty({ nullable: true, type: String })
  actorId!: string | null;

  @ApiProperty()
  actorRole!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  entity!: string;

  @ApiProperty({ nullable: true, type: String })
  entityId!: string | null;

  @ApiProperty()
  correlationId!: string;
}

export class AuditPageDto {
  @ApiProperty({ type: [AuditEntryDto], description: 'Newest first' })
  entries!: AuditEntryDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Pass as `before` for the next page; null on the last page',
  })
  nextBefore!: string | null;
}
