import { ApiProperty } from '@nestjs/swagger';

export class LedgerLineDto {
  @ApiProperty({ type: String, nullable: true })
  bookingId!: string | null;

  @ApiProperty({ enum: ['earning', 'reversal', 'no_show_fee', 'payout'] })
  kind!: string;

  @ApiProperty()
  amountPaise!: number;

  @ApiProperty()
  availableAt!: Date;

  @ApiProperty()
  paidOut!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class EarningsDto {
  @ApiProperty({ description: 'Earned, not yet paid out' })
  balancePaise!: number;

  @ApiProperty({ description: 'Of the balance, still in the complaint hold' })
  heldPaise!: number;

  @ApiProperty()
  paidOutPaise!: number;

  @ApiProperty()
  nextPayoutAt!: Date;

  @ApiProperty({ type: [LedgerLineDto] })
  lines!: LedgerLineDto[];
}

export class PayoutRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  runAt!: Date;

  @ApiProperty()
  providerCount!: number;

  @ApiProperty()
  totalPaise!: number;
}

export class FinanceDto {
  @ApiProperty()
  paidPaise!: number;

  @ApiProperty()
  refundedPaise!: number;

  @ApiProperty()
  commissionPaise!: number;

  @ApiProperty()
  commissionBps!: number;

  @ApiProperty({ type: [PayoutRunDto] })
  runs!: PayoutRunDto[];
}
