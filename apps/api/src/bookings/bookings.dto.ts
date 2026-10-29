import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { UploadDto } from '../onboarding/onboarding.dto.js';
import { BOOKING_STATUSES, type BookingStatus } from './booking-transitions.js';

const LOCALES = ['or', 'en', 'hi'] as const;

export class CreateBookingDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'The chosen provider listing' })
  @IsOptional()
  @IsUUID('4')
  listingId?: string;

  @ApiPropertyOptional({ description: 'Any available provider for this catalogue item (A10)' })
  @IsOptional()
  @Matches(/^[a-z0-9_]{2,60}$/)
  itemCode?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @ApiProperty()
  @Matches(/^[1-9]\d{5}$/)
  pin!: string;

  @ApiProperty({
    minLength: 5,
    maxLength: 300,
    description: 'Home address; shown to the provider once confirmed',
  })
  @IsString()
  @Length(5, 300)
  address!: string;

  @ApiPropertyOptional({ maxLength: 500, description: "The patient's needs, for the provider" })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'A linked patient; the booker when absent' })
  @IsOptional()
  @IsUUID('4')
  recipientId?: string;

  @ApiPropertyOptional({ enum: ['female', 'male'] })
  @IsOptional()
  @IsIn(['female', 'male'])
  genderPreference?: 'female' | 'male';

  @ApiPropertyOptional({ minimum: 1, maximum: 30, description: 'Attendant shifts: number of days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  shiftDays?: number;

  @ApiPropertyOptional({
    type: UploadDto,
    description: 'Required when the item needs a prescription (SL-06)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UploadDto)
  prescription?: UploadDto;

  @ApiPropertyOptional({ enum: LOCALES })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: (typeof LOCALES)[number];

  @ApiPropertyOptional({
    type: [String],
    description: 'Lab cart: more tests from the same lab (LB-03)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  extraListingIds?: string[];

  @ApiPropertyOptional({
    enum: ['home', 'walk_in'],
    description: 'Lab tests: where the sample is taken (LB-02)',
  })
  @IsOptional()
  @IsIn(['home', 'walk_in'])
  collection?: 'home' | 'walk_in';
}

export class CheckoutDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  amountPaise!: number;

  @ApiProperty({ description: 'The gateway is the sandbox double: pay with the sandbox route' })
  sandbox!: boolean;
}

export class FeesDto {
  @ApiProperty()
  feePaise!: number;

  @ApiProperty()
  travelPaise!: number;

  @ApiProperty()
  discountPaise!: number;

  @ApiProperty()
  totalPaise!: number;

  @ApiProperty({ description: 'Paid at booking' })
  advancePaise!: number;

  @ApiProperty()
  paidPaise!: number;

  @ApiProperty()
  refundedPaise!: number;

  @ApiProperty({ description: 'Still to pay before the first shift' })
  balanceDuePaise!: number;
}

export class BookingEventDto {
  @ApiProperty()
  fromStatus!: string;

  @ApiProperty()
  toStatus!: string;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty()
  actorRole!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class RefundDto {
  @ApiProperty()
  amountPaise!: number;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: ['pending', 'processed', 'failed'] })
  status!: string;
}

export class PartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class BookingSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BOOKING_STATUSES })
  status!: BookingStatus;

  @ApiProperty({ type: String, nullable: true })
  cancelledBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  noShowParty!: string | null;

  @ApiProperty({ type: String, nullable: true })
  statusReason!: string | null;

  @ApiProperty()
  service!: string;

  @ApiProperty()
  itemCode!: string;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ enum: ['visit', 'shift', 'lab_test'] })
  kind!: 'visit' | 'shift' | 'lab_test';

  @ApiProperty({ enum: ['chosen', 'any'] })
  matching!: 'chosen' | 'any';

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'To book the same again in one step (BK-09)',
  })
  listingId!: string | null;

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty()
  endsAt!: Date;

  @ApiProperty()
  shiftDays!: number;

  @ApiProperty()
  pin!: string;

  @ApiProperty({ type: PartyDto, nullable: true })
  provider!: PartyDto | null;

  @ApiProperty({ description: 'Who the care is for' })
  recipientName!: string;

  @ApiProperty({ type: FeesDto })
  fees!: FeesDto;

  @ApiProperty({ type: Date, nullable: true })
  acceptBy!: Date | null;
}

export class BookingDto extends BookingSummaryDto {
  @ApiProperty()
  address!: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [BookingEventDto] })
  events!: BookingEventDto[];

  @ApiProperty({ type: [RefundDto] })
  refunds!: RefundDto[];

  @ApiProperty({ description: 'The patient may cancel now' })
  canCancel!: boolean;

  @ApiProperty({ description: 'What cancelling now would refund (BK-04)' })
  refundIfCancelledPaise!: number;

  @ApiProperty({ type: CheckoutDto, nullable: true, description: 'An unpaid order to pay' })
  checkout!: CheckoutDto | null;

  @ApiProperty()
  hasPrescription!: boolean;
}

export class CancelDto {
  @ApiProperty({
    enum: [
      'changed_plans',
      'found_other_care',
      'patient_unwell',
      'other',
      'provider_unavailable',
      'admin_decision',
    ],
  })
  @IsIn([
    'changed_plans',
    'found_other_care',
    'patient_unwell',
    'other',
    'provider_unavailable',
    'admin_decision',
  ])
  reason!: string;
}

export class DeclineDto {
  @ApiProperty({ enum: ['unavailable', 'too_far', 'prescription_invalid', 'other'] })
  @IsIn(['unavailable', 'too_far', 'prescription_invalid', 'other'])
  reason!: 'unavailable' | 'too_far' | 'prescription_invalid' | 'other';
}

/** What a provider sees of a request before accepting: no address and no contact (A10). */
export class ProviderRequestDto {
  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ enum: ['visit', 'shift', 'lab_test'] })
  kind!: 'visit' | 'shift' | 'lab_test';

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty()
  endsAt!: Date;

  @ApiProperty()
  shiftDays!: number;

  @ApiProperty()
  pin!: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'A prescription is attached to review (A14)' })
  hasPrescription!: boolean;

  @ApiProperty({ description: 'What the provider would earn, in paise' })
  earningPaise!: number;

  @ApiProperty({ type: Date, nullable: true })
  acceptBy!: Date | null;
}

/** A confirmed booking as its provider sees it: address and contact (HS-02). */
export class ProviderBookingDto extends BookingSummaryDto {
  @ApiProperty({ type: String, nullable: true, description: 'Only once confirmed' })
  address!: string | null;

  @ApiProperty({ type: String, nullable: true, description: "The booker's number, once confirmed" })
  contactMobile!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty()
  hasPrescription!: boolean;

  @ApiProperty()
  earningPaise!: number;
}

export class AnySlotsQueryDto {
  @ApiProperty()
  @Matches(/^[a-z0-9_]{2,60}$/)
  item!: string;

  @ApiProperty()
  @Matches(/^[1-9]\d{5}$/)
  pin!: string;

  @ApiPropertyOptional({ enum: ['female', 'male'] })
  @IsOptional()
  @IsIn(['female', 'male'])
  gender?: 'female' | 'male';
}

export class AnySlotsDto {
  @ApiProperty({ type: [Date] })
  slots!: Date[];

  @ApiProperty({
    description: 'Highest price among the providers who may take it; any difference is refunded',
  })
  quotePaise!: number;

  @ApiProperty()
  providers!: number;
}

export class AdminBookingQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: BookingStatus;
}

export class ManualRefundDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty({ enum: ['service_complaint', 'goodwill', 'duplicate_payment', 'other'] })
  @IsIn(['service_complaint', 'goodwill', 'duplicate_payment', 'other'])
  reason!: string;
}

export class ReassignDto {
  @ApiProperty({ format: 'uuid', description: 'Listing of the new provider' })
  @IsUUID('4')
  listingId!: string;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  template!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  params!: Record<string, string>;

  @ApiProperty({ type: String, nullable: true })
  bookingId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  readAt!: Date | null;
}

/** The policy shown before payment (BK-04, AD-08). */
export class BookingPolicyDto {
  @ApiProperty()
  freeCancellationHours!: number;

  @ApiProperty()
  lateRefundPercent!: number;

  @ApiProperty()
  attendantAdvancePercent!: number;

  @ApiProperty()
  acceptanceWindowMinutes!: number;

  @ApiProperty({ description: 'How long a provider waits before marking a patient absent (A15)' })
  noShowWaitMinutes!: number;
}
