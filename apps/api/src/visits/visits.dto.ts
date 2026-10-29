import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CodeDto {
  @ApiProperty({ pattern: '^\\d{6}$' })
  @Matches(/^\d{6}$/)
  code!: string;
}

/** The visit notes (HS-04): what was done, what was seen, what next. Restricted. */
export class VisitNotesDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  procedure!: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  observations!: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  advice!: string;
}

export class VisitCodeDto {
  @ApiProperty({ description: 'Show this to the provider only when they are at the door' })
  code!: string;

  @ApiProperty({ description: '`visit`, or the shift and whether it checks in or out' })
  moment!: string;
}

export class ShiftDto {
  @ApiProperty()
  dayIndex!: number;

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty()
  endsAt!: Date;

  @ApiProperty({ enum: ['scheduled', 'checked_in', 'checked_out', 'missed', 'replaced'] })
  status!: string;

  @ApiProperty({ type: Date, nullable: true })
  checkedInAt!: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  checkedOutAt!: Date | null;
}

export class VisitRecordDto extends VisitNotesDto {
  @ApiProperty()
  completedAt!: Date;
}
