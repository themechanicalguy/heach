import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class ReviewInputDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;

  @ApiPropertyOptional({ maxLength: 500, description: 'Shown publicly on the provider profile' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  comment?: string;
}

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  stars!: number;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AdminReviewDto extends ReviewDto {
  @ApiProperty({ format: 'uuid' })
  providerId!: string;

  @ApiProperty()
  reported!: boolean;

  @ApiProperty()
  hidden!: boolean;

  @ApiProperty({ type: String, nullable: true })
  hiddenReason!: string | null;
}

export class HideDto {
  @ApiProperty({ enum: ['abusive', 'personal_data', 'not_about_service', 'fake'] })
  @IsIn(['abusive', 'personal_data', 'not_about_service', 'fake'])
  reason!: string;
}
