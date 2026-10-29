import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { GENDERS, type Gender, NAME_PATTERN } from '../accounts/setup-rules.js';

export const RELATIONSHIPS = [
  'parent',
  'child',
  'spouse',
  'sibling',
  'grandparent',
  'grandchild',
  'other_relative',
  'other',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

/** A person the account books for (AC-03); a profile, not an account (default D-1). */
export class LinkedPatientInputDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(1, 100)
  @Matches(NAME_PATTERN)
  fullName!: string;

  @ApiProperty({ minimum: 1900, description: 'Year of birth: the age without a full date (D-2)' })
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear!: number;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  gender!: Gender;

  @ApiProperty({ enum: RELATIONSHIPS, description: 'Who this person is to the account holder' })
  @IsIn(RELATIONSHIPS)
  relationship!: Relationship;
}

export class LinkedPatientDto extends LinkedPatientInputDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}
