import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { UploadDto } from '../onboarding/onboarding.dto.js';

export class LabItemDto {
  @ApiProperty()
  itemCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  feePaise!: number;

  @ApiProperty({ type: String, nullable: true })
  sampleType!: string | null;
}

export class LabEventDto {
  @ApiProperty()
  stage!: string;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty()
  actorRole!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class LabReportVersionDto {
  @ApiProperty()
  version!: number;

  @ApiProperty({ type: String, nullable: true })
  correctionReason!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class CollectorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Verified identity badge (LB-05)' })
  verified!: boolean;
}

export class LabOrderDto {
  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ enum: ['home', 'walk_in'] })
  collection!: 'home' | 'walk_in';

  @ApiProperty({
    enum: ['booked', 'collector_assigned', 'sample_collected', 'received', 'report_ready'],
  })
  stage!: string;

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty({ type: [LabItemDto] })
  items!: LabItemDto[];

  @ApiProperty({ type: CollectorDto, nullable: true })
  collector!: CollectorDto | null;

  @ApiProperty({ type: String, nullable: true })
  sampleId!: string | null;

  @ApiProperty({ description: 'Report promised within this many hours of collection' })
  reportHours!: number;

  @ApiProperty({ type: Date, nullable: true })
  reportDueAt!: Date | null;

  @ApiProperty({ type: [LabEventDto] })
  events!: LabEventDto[];

  @ApiProperty({ type: [LabReportVersionDto] })
  reports!: LabReportVersionDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'For the collector of a home collection',
  })
  address!: string | null;
}

export class AssignCollectorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  collectorId!: string;
}

export class SampleCodeDto {
  @ApiProperty()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ReportUploadDto extends UploadDto {
  @ApiProperty({
    description: "The sample's identifier, checked against the booking (edge case 14)",
  })
  @Matches(/^HX-[0-9A-Z]{10}$/)
  sampleId!: string;

  @ApiPropertyOptional({ enum: ['wrong_value', 'wrong_patient_detail', 'missing_test', 'other'] })
  @IsOptional()
  @IsIn(['wrong_value', 'wrong_patient_detail', 'missing_test', 'other'])
  correctionReason?: string;
}

export class RecollectDto {
  @ApiProperty({ enum: ['sample_haemolysed', 'insufficient_sample', 'sample_lost', 'other'] })
  @IsIn(['sample_haemolysed', 'insufficient_sample', 'sample_lost', 'other'])
  reason!: string;
}

export class LabDashboardDto {
  @ApiProperty()
  todayCollections!: number;

  @ApiProperty()
  pendingReports!: number;

  @ApiProperty({ type: Number, nullable: true })
  averageTurnaroundHours!: number | null;

  @ApiProperty({ description: 'Reports ready later than promised' })
  lateReports!: number;
}

export class AdminLabDto extends LabDashboardDto {
  @ApiProperty({ format: 'uuid' })
  labId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  orders!: number;

  @ApiProperty()
  corrections!: number;
}
