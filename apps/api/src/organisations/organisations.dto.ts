import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength } from 'class-validator';
import { STAFF_ROLES, type StaffRole } from '../accounts/setup-rules.js';

const ORGANISATION_NAME = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,&'()-]*$/u;

export class OrganisationNameDto {
  @ApiProperty({ maxLength: 120, description: "The clinic's or lab's name" })
  @IsString()
  @Length(1, 120)
  @Matches(ORGANISATION_NAME)
  name!: string;
}

export class InviteDto {
  @ApiProperty({ description: 'Indian mobile number of the person invited', example: '9000000002' })
  @IsString()
  @MaxLength(20)
  mobile!: string;
}

export class MemberDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: STAFF_ROLES })
  role!: StaffRole;

  @ApiProperty({ enum: ['invited', 'active'] })
  status!: 'invited' | 'active';

  @ApiProperty({ description: 'Last four digits only' })
  mobile!: string;

  @ApiProperty({ format: 'date-time' })
  invitedAt!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  acceptedAt!: string | null;
}

export class OrganisationDto {
  @ApiProperty({ enum: ['lab', 'clinic'] })
  kind!: 'lab' | 'clinic';

  @ApiProperty({ nullable: true, type: String, description: 'Null until a clinic is named' })
  name!: string | null;

  @ApiProperty({ description: "The owner's application is approved; staff work opens then" })
  approved!: boolean;

  @ApiProperty({ enum: STAFF_ROLES, description: 'The role an invitation from here carries' })
  staffRole!: StaffRole;

  @ApiProperty({ type: [MemberDto] })
  members!: MemberDto[];
}

export class InvitationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: STAFF_ROLES })
  role!: StaffRole;

  @ApiProperty({ enum: ['lab', 'clinic'] })
  organisationKind!: 'lab' | 'clinic';

  @ApiProperty()
  organisationName!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class MembershipDto {
  @ApiProperty({ enum: STAFF_ROLES })
  role!: StaffRole;

  @ApiProperty({ enum: ['lab', 'clinic'] })
  organisationKind!: 'lab' | 'clinic';

  @ApiProperty()
  organisationName!: string;

  @ApiProperty({ description: 'Lab or clinic work opens only when this is true (O-1)' })
  organisationApproved!: boolean;
}
