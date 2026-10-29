import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDate, IsInt, Max, Min, ValidateNested } from 'class-validator';

export class WeeklyRuleDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 is Sunday' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ minimum: 0, maximum: 1439, description: 'Minutes after midnight IST' })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @ApiProperty({ minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;
}

export class AvailabilityInputDto {
  @ApiProperty({ type: [WeeklyRuleDto] })
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => WeeklyRuleDto)
  rules!: WeeklyRuleDto[];

  @ApiProperty({ minimum: 0, maximum: 120 })
  @IsInt()
  @Min(0)
  @Max(120)
  bufferMinutes!: number;
}

export class BlockInputDto {
  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  start!: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  end!: Date;
}

export class BlockDto extends BlockInputDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}

export class AvailabilityDto {
  @ApiProperty({ type: [WeeklyRuleDto] })
  rules!: WeeklyRuleDto[];

  @ApiProperty()
  bufferMinutes!: number;

  @ApiProperty({ type: [BlockDto] })
  blocks!: BlockDto[];
}
