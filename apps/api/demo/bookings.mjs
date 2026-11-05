// Bookings through the real journeys (J3, J7): the patient books and pays in the sandbox, the
// provider accepts, the visit is started with the patient's code and completed, then rated.
import { Buffer } from 'node:buffer';
import { UPLOAD, as } from './client.mjs';
import { LOCALITIES } from './data.mjs';
import { backdate, moveToSoon, settle } from './db.mjs';

const PDF = Buffer.from('%PDF-1.7\n% synthetic demo report\n').toString('base64');
const IST_OFFSET_MS = 330 * 60_000;
// Items a patient books only with a prescription attached (catalogue prescription_required, BK-05).
const NEEDS_PRESCRIPTION = new Set([
  'nursing_injection',
  'nursing_catheter_care',
  'nursing_iv_fluids',
]);
const prescription = {
  contentType: 'application/pdf',
  contentBase64: Buffer.from('%PDF-1.7\n% synthetic demo prescription\n').toString('base64'),
};

/** The first free slot `daysAhead` days from now at or after `hour` o'clock in India. */
async function slotFor(patient, providerId, listingId, daysAhead, hour) {
  const { slots } = await as(
    patient,
    `/v1/providers/${providerId}/slots?listing=${listingId}&days=${String(daysAhead + 2)}`,
  );
  const wanted = (slot) => {
    const local = new Date(new Date(slot).getTime() + IST_OFFSET_MS);
    const days = Math.floor((local - startOfTodayIst()) / 86_400_000);
    return days >= daysAhead && local.getUTCHours() >= hour;
  };
  const slot = slots.find(wanted) ?? slots.at(-1);
  if (!slot) throw new Error('No free slot');
  return slot;
}

function startOfTodayIst() {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export const addressAt = (pin, house) => `${house}, ${LOCALITIES[pin] ?? 'Odisha'} ${pin}`;

/** Books and pays; the booking then waits for the provider (BK-03). Returns the booking ID. */
export async function bookAndPay(patient, order) {
  const startsAt = await slotFor(
    patient,
    order.provider.accountId,
    order.listingId,
    order.daysAhead,
    order.hour ?? 10,
  );
  const withPrescription = NEEDS_PRESCRIPTION.has(order.item);
  const booking = await as(patient, '/v1/bookings', {
    ...(withPrescription ? { contentType: UPLOAD } : {}),
    body: {
      ...(withPrescription ? { prescription } : {}),
      listingId: order.listingId,
      startsAt,
      pin: patient.pin,
      address: addressAt(patient.pin, patient.house),
      locale: 'en',
      ...(order.notes ? { notes: order.notes } : {}),
      ...(order.recipientId ? { recipientId: order.recipientId } : {}),
      ...(order.shiftDays ? { shiftDays: order.shiftDays } : {}),
      ...(order.extraListingIds ? { extraListingIds: order.extraListingIds } : {}),
      ...(order.collection ? { collection: order.collection } : {}),
    },
  });
  if (booking.checkout) {
    await as(patient, `/v1/payments/sandbox/${booking.checkout.orderId}/pay`, { body: {} });
  }
  return booking.id;
}

export async function accept(provider, bookingId) {
  await as(provider, `/v1/provider/requests/${bookingId}/accept`, { body: {} });
}

const codeOf = async (patient, bookingId, lab = false) =>
  (await as(patient, `/v1/bookings/${bookingId}${lab ? '/lab' : ''}/code`)).code;

/** A home visit carried out now: started with the patient's code, completed with notes (HS-03, HS-04). */
export async function carryOutVisit(db, patient, provider, bookingId, notes) {
  await moveToSoon(db, bookingId);
  const code = await codeOf(patient, bookingId);
  await as(provider, `/v1/provider/bookings/${bookingId}/start`, { body: { code } });
  await as(provider, `/v1/provider/bookings/${bookingId}/complete`, { body: notes });
}

/** A lab order collected with the patient's code, received and reported (J7). */
export async function carryOutLab(db, patient, lab, bookingId) {
  await moveToSoon(db, bookingId);
  const code = await codeOf(patient, bookingId, true);
  const { sampleId } = await as(lab, `/v1/provider/lab/orders/${bookingId}/collect`, {
    body: { code },
  });
  await as(lab, `/v1/provider/lab/orders/${bookingId}/received`, { body: {} });
  await as(lab, `/v1/provider/lab/orders/${bookingId}/report`, {
    contentType: UPLOAD,
    body: { contentType: 'application/pdf', contentBase64: PDF, sampleId },
  });
}

export async function rate(patient, bookingId, review) {
  await as(patient, `/v1/bookings/${bookingId}/review`, { body: review });
}

export async function cancel(patient, bookingId, reason) {
  await as(patient, `/v1/bookings/${bookingId}/cancel`, { body: { reason } });
}

/** Book, accept, carry out, rate and date back: one finished booking in the history. */
export async function finishedVisit(db, patient, provider, order, story) {
  const id = await bookAndPay(patient, { ...order, daysAhead: 1 });
  await accept(provider, id);
  if (story.lab) await carryOutLab(db, patient, provider, id);
  else await carryOutVisit(db, patient, provider, id, story.notes);
  if (story.review) await rate(patient, id, story.review);
  await settle(db, id);
  await backdate(db, id, story.daysAgo, 9 + (story.daysAgo % 8));
  return id;
}
