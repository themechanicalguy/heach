import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { adminSignIn } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import { pay } from './booking-helpers.js';

export const texts = (name: string) => {
  const text = { name, inclusions: 'Synthetic inclusions', exclusions: 'Synthetic exclusions' };
  return { or: text, en: text, hi: text };
};

export async function packagePlan(
  app: INestApplication<App>,
  itemCode: string,
  units: number,
  pricePaise: number,
  discountPercent = 0,
  familyMembers = 0,
) {
  const admin = await adminSignIn(app, 'super_admin');
  const created = await request(app.getHttpServer())
    .post('/admin/v1/plans')
    .set(bearer(admin))
    .send({
      kind: 'package',
      itemCode,
      units,
      discountPercent,
      familyMembers,
      validityDays: 60,
      pricePaise,
      texts: texts(`Synthetic ${itemCode} pack`),
    })
    .expect(201);
  return (created.body as { id: string }).id;
}

/** Buys and pays for a plan; returns the purchase ID. */
export async function buy(
  app: INestApplication<App>,
  login: Login,
  planId: string,
): Promise<string> {
  const checkout = (
    await request(app.getHttpServer())
      .post(`/v1/plans/${planId}/purchase`)
      .set(bearer(login))
      .expect(201)
  ).body as { purchaseId: string; orderId: string };
  await pay(app, login, checkout.orderId);
  return checkout.purchaseId;
}

export const plansOf = async (app: INestApplication<App>, login: Login) =>
  (await request(app.getHttpServer()).get('/v1/me/plans?locale=en').set(bearer(login)).expect(200))
    .body as {
    id: string;
    status: string;
    autoRenew: boolean;
    renewalPaused: boolean;
    endsAt: string | null;
    entitlements: { unitsTotal: number; unitsUsed: number }[];
    refundIfCancelledPaise: number;
  }[];

/** A platform subscription for one service, monthly, created live by a super admin. */
export async function subscriptionPlan(
  app: INestApplication<App>,
  service: string,
  units: number,
  pricePaise: number,
) {
  const admin = await adminSignIn(app, 'super_admin');
  const created = await request(app.getHttpServer())
    .post('/admin/v1/plans')
    .set(bearer(admin))
    .send({
      kind: 'subscription',
      service,
      period: 'monthly',
      units,
      discountPercent: 10,
      familyMembers: 0,
      validityDays: 30,
      pricePaise,
      texts: texts(`Synthetic ${service} subscription`),
    })
    .expect(201);
  return (created.body as { id: string }).id;
}
