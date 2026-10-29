export interface FeeInput {
  /** The listing's fee per visit or per shift, in paise. */
  unitFeePaise: number;
  travelPaise: number;
  units: number;
  commissionBps: number;
  /** Share paid at booking; the rest before the first shift (Q-ADVANCE). 100 for visits. */
  advancePercent: number;
}

export interface FeeBreakdown {
  feePaise: number;
  travelPaise: number;
  discountPaise: number;
  totalPaise: number;
  commissionPaise: number;
  advancePaise: number;
}

/** The fee breakdown frozen on the booking (BK-01, PY-01). Commission is on the fee, not travel. */
export function feeBreakdown(input: FeeInput): FeeBreakdown {
  const feePaise = input.unitFeePaise * input.units;
  const totalPaise = feePaise + input.travelPaise;
  return {
    feePaise,
    travelPaise: input.travelPaise,
    discountPaise: 0,
    totalPaise,
    commissionPaise: Math.round((feePaise * input.commissionBps) / 10_000),
    advancePaise: Math.round((totalPaise * input.advancePercent) / 100),
  };
}

export interface RefundPolicy {
  freeCancellationHours: number;
  lateRefundPercent: number;
}

/**
 * What a cancellation refunds (BK-04, PY-02): everything paid while the provider has not yet
 * accepted, or when the provider or admin cancels; for a patient cancelling a confirmed booking,
 * everything before the free window and the late share after it.
 */
export function cancellationRefund(input: {
  status: 'pending_payment' | 'requested' | 'confirmed' | 'in_progress';
  by: 'patient' | 'provider' | 'admin' | 'system';
  paidPaise: number;
  startsAt: Date;
  now: Date;
  policy: RefundPolicy;
}): number {
  if (input.by !== 'patient' || input.status !== 'confirmed') return input.paidPaise;
  const hoursLeft = (input.startsAt.getTime() - input.now.getTime()) / 3_600_000;
  if (hoursLeft >= input.policy.freeCancellationHours) return input.paidPaise;
  return Math.round((input.paidPaise * input.policy.lateRefundPercent) / 100);
}

/** What the provider earns from a completed booking: the fee less commission, plus travel. */
export function providerEarning(booking: {
  feePaise: number;
  travelPaise: number;
  commissionPaise: number;
  discountPaise: number;
}) {
  return booking.feePaise + booking.travelPaise - booking.commissionPaise;
}
