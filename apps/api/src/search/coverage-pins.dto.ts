import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SERVICES, type Service } from '../catalogue/services.js';
import { PIN_BANDS, type PinBand } from './coverage-pins.js';

export class PinCoverageQueryDto {
  @ApiProperty({ enum: SERVICES })
  @IsIn(SERVICES)
  service!: Service;
}

/** One serviceable PIN. Public: names no provider, only how many serve it. */
export class PinCoverageDto {
  @ApiProperty()
  pin!: string;

  @ApiProperty()
  district!: string;

  @ApiProperty({ description: 'Approved providers with an active listing serving this PIN' })
  providers!: number;

  @ApiProperty({ enum: PIN_BANDS })
  band!: PinBand;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Soonest free time in the next 7 days; a guide, confirmed when booking',
  })
  nextAvailable!: string | null;
}
