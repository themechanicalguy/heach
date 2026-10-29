import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { FakePaymentGateway } from '../src/adapters/fakes.js';
import { PAYMENT_GATEWAY } from '../src/adapters/payments.port.js';
import { JobRunner } from '../src/jobs/runner/job-runner.js';
import { bearer, type Login } from './auth-helpers.js';
import { PILOT_PIN, SYNTHETIC_PDF } from './provider-helpers.js';

export interface Booking {
  id: string;
  status: string;
  cancelledBy: string | null;
  statusReason: string | null;
  provider: { id: string; name: string } | null;
  fees: {
    totalPaise: number;
    advancePaise: number;
    paidPaise: number;
    refundedPaise: number;
    balanceDuePaise: number;
  };
  checkout: { orderId: string; amountPaise: number; sandbox: boolean } | null;
  refundIfCancelledPaise: number;
  events: { toStatus: string; reason: string | null }[];
}

export const gateway = (app: INestApplication<App>) => app.get<FakePaymentGateway>(PAYMENT_GATEWAY);
export const runJobs = (app: INestApplication<App>, minutesAhead = 0) =>
  app.get(JobRunner).runDue(new Date(Date.now() + minutesAhead * 60_000), 500);

export async function firstSlot(
  app: INestApplication<App>,
  providerId: string,
  listingId: string,
  index = 0,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .get(`/v1/providers/${providerId}/slots?listing=${listingId}&days=7`)
    .expect(200);
  const slot = (response.body as { slots: string[] }).slots[index];
  if (!slot) throw new Error('No slot');
  return slot;
}

export function createBooking(
  app: INestApplication<App>,
  login: Login,
  body: Record<string, unknown>,
) {
  return request(app.getHttpServer())
    .post('/v1/bookings')
    .set(bearer(login))
    .set('Content-Type', 'application/vnd.heach.upload+json')
    .send(
      JSON.stringify({
        pin: PILOT_PIN,
        address: '12 Synthetic Lane, Bhubaneswar',
        locale: 'en',
        ...body,
      }),
    );
}

export const PRESCRIPTION = { contentType: 'application/pdf', contentBase64: SYNTHETIC_PDF };

/** Pays an order through the sandbox, as the hosted checkout would. */
export async function pay(app: INestApplication<App>, login: Login, orderId: string) {
  return request(app.getHttpServer())
    .post(`/v1/payments/sandbox/${orderId}/pay`)
    .set(bearer(login))
    .expect(200);
}

export async function bookingOf(
  app: INestApplication<App>,
  login: Login,
  id: string,
): Promise<Booking> {
  return (
    await request(app.getHttpServer())
      .get(`/v1/bookings/${id}?locale=en`)
      .set(bearer(login))
      .expect(200)
  ).body as Booking;
}

/** A booking made and paid: Requested, waiting for the provider. */
export async function paidBooking(
  app: INestApplication<App>,
  login: Login,
  body: Record<string, unknown>,
): Promise<Booking> {
  const created = (await createBooking(app, login, body).expect(201)).body as Booking;
  await pay(app, login, created.checkout?.orderId ?? '');
  return bookingOf(app, login, created.id);
}
