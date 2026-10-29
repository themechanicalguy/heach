const MINUTE = 60_000;

/** A start code works from 30 minutes before the slot to 3 hours after it (edge case 6). */
export function startWindowOpen(startsAt: Date, now: Date): boolean {
  const time = now.getTime();
  return time >= startsAt.getTime() - 30 * MINUTE && time <= startsAt.getTime() + 180 * MINUTE;
}

/** The provider may mark the patient absent only after waiting the set time (amendment A15). */
export function patientNoShowAllowed(startsAt: Date, now: Date, waitMinutes: number): boolean {
  return now.getTime() >= startsAt.getTime() + waitMinutes * MINUTE;
}

/** The patient may report the provider absent 30 minutes after the start (amendment A12). */
export function providerNoShowAllowed(startsAt: Date, now: Date): boolean {
  return now.getTime() >= startsAt.getTime() + 30 * MINUTE;
}

/** Split an earning across shifts: equal parts, the last shift takes the remainder (PK-07). */
export function shiftShare(totalPaise: number, days: number, dayIndex: number): number {
  const part = Math.floor(totalPaise / days);
  return dayIndex === days - 1 ? totalPaise - part * (days - 1) : part;
}

/** What a patient no-show costs and returns (A15): the fee share to the provider, the rest back. */
export function noShowSplit(paidPaise: number, feePercent: number, commissionBps: number) {
  const feePaise = Math.round((paidPaise * feePercent) / 100);
  return {
    refundPaise: paidPaise - feePaise,
    providerPaise: feePaise - Math.round((feePaise * commissionBps) / 10_000),
  };
}
