import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const NOTE_MAX_LENGTH = 2000;

export class CreateNoteDto {
  @ApiProperty({ maxLength: NOTE_MAX_LENGTH, description: 'Restricted: encrypted at rest' })
  @IsString()
  @MinLength(1)
  @MaxLength(NOTE_MAX_LENGTH)
  body!: string;
}

export class CreatedNoteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class NoteDto extends CreatedNoteDto {
  @ApiProperty({ description: 'Restricted' })
  body!: string;
}
