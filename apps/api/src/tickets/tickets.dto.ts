import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export const TICKET_TOPICS = [
  'safety_threat',
  'harassment',
  'clinical_emergency',
  'service_quality',
  'billing',
  'no_show',
  'other',
] as const;

export class TicketInputDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  bookingId?: string;

  @ApiProperty({ enum: ['safety', 'complaint', 'help'] })
  @IsIn(['safety', 'complaint', 'help'])
  kind!: 'safety' | 'complaint' | 'help';

  @ApiProperty({ enum: TICKET_TOPICS })
  @IsIn(TICKET_TOPICS)
  topic!: (typeof TICKET_TOPICS)[number];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;
}

export class TicketDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  bookingId!: string | null;

  @ApiProperty()
  kind!: string;

  @ApiProperty()
  priority!: string;

  @ApiProperty()
  topic!: string;

  @ApiProperty({ enum: ['open', 'assigned', 'resolved'] })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  resolution!: string | null;

  @ApiProperty()
  raisedByRole!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TicketRestrictedDto {
  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [String] })
  notes!: string[];

  @ApiProperty()
  grantExpiresAt!: Date;
}

export class NoteInputDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  note!: string;
}

export class ResolveDto {
  @ApiProperty({
    enum: [
      'resolved_with_patient',
      'resolved_with_provider',
      'refund_issued',
      'provider_suspended',
      'no_action_needed',
      'duplicate',
    ],
  })
  @IsIn([
    'resolved_with_patient',
    'resolved_with_provider',
    'refund_issued',
    'provider_suspended',
    'no_action_needed',
    'duplicate',
  ])
  resolution!: string;
}

export class BreakGlassDto {
  @ApiProperty({ enum: ['safety_investigation', 'complaint_investigation', 'legal_request'] })
  @IsIn(['safety_investigation', 'complaint_investigation', 'legal_request'])
  reason!: string;
}

export class TicketQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'assigned', 'resolved'] })
  @IsOptional()
  @IsIn(['open', 'assigned', 'resolved'])
  status?: string;
}

export class AccessEntryDto {
  @ApiProperty()
  adminRole!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  grantedAt!: Date;

  @ApiProperty()
  expiresAt!: Date;
}
