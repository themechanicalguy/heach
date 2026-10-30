import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import type { App } from 'supertest/types.js';
import type { FakeSmsSender } from '../src/adapters/fakes.js';
import { SMS_SENDER } from '../src/adapters/sms.port.js';
import { PaymentEventsService } from '../src/bookings/payment-events.service.js';
import { PG_POOL } from '../src/data-stores/data-stores.tokens.js';
import { RenewalsService } from '../src/plans/renewals.service.js';
import { signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { gateway } from './booking-helpers.js';
import { buy, packagePlan, plansOf, subscriptionPlan } from './plan-helpers.js';

/** The gateway's webhook for the last order it created, paid or failed. */
async function settleLastOrder(app: INestApplication<App>, outcome: 'paid' | 'failed') {
  const fake = gateway(app);
  const orderId = [...fake.orders.keys()].at(-1) ?? '';
  const { body, signature } =
    outcome === 'paid' ? fake.sandboxCapture(orderId) : fake.sandboxFail(orderId);
  await app.get(PaymentEventsService).handle(body, signature);
}

const purchaseRow = async (app: INestApplication<App>, id: string) =>
  (
    await app.get<pg.Pool>(PG_POOL).query<{
      autoRenew: boolean;
      attempts: number;
      paused: boolean;
      mandateId: string | null;
    }>(
      `SELECT auto_renew AS "autoRenew", renewal_attempts AS attempts, renewal_paused AS paused,
                mandate_id AS "mandateId" FROM app.plan_purchase WHERE id = $1`,
      [id],
    )
  ).rows[0];

const sentTemplates = (app: INestApplication<App>) =>
  app.get<FakeSmsSender>(SMS_SENDER).sent.map((message) => message.templateId);

describe('Subscription renewal (PK-05, PK-06)', () => {
  const { app, server } = useApp();

  it('PK-05 notice, a failed debit, a retry that renews into the next period', async () => {
    const planId = await subscriptionPlan(app(), 'nursing', 4, 200_000);
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    await server()
      .post(`/v1/me/plans/${purchaseId}/auto-renew`)
      .set(bearer(patient.login))
      .send({ enabled: true })
      .expect(204);
    const mandateId = (await purchaseRow(app(), purchaseId))?.mandateId ?? '';
    expect(gateway(app()).mandates.get(mandateId)).toMatchObject({ maxAmountPaise: 200_000 });

    const renewals = app().get(RenewalsService);
    await renewals.notice(purchaseId);
    expect(sentTemplates(app())).toContain('plan_renewal_notice');

    const orders = gateway(app()).orders.size;
    await renewals.charge(purchaseId, 1);
    expect(gateway(app()).orders.size).toBe(orders + 1);
    await settleLastOrder(app(), 'failed');
    expect(await purchaseRow(app(), purchaseId)).toMatchObject({ attempts: 1, autoRenew: true });
    // The same attempt never charges twice.
    await renewals.charge(purchaseId, 1);
    expect(gateway(app()).orders.size).toBe(orders + 1);

    await renewals.charge(purchaseId, 2);
    await settleLastOrder(app(), 'paid');
    const [renewed, first] = await plansOf(app(), patient.login);
    expect(renewed).toMatchObject({ status: 'active', autoRenew: true, renewalPaused: false });
    expect(first?.id).toBe(purchaseId);
    expect(new Date(renewed?.endsAt ?? 0).getTime()).toBeGreaterThan(
      new Date(first?.endsAt ?? 0).getTime(),
    );
    expect(await purchaseRow(app(), purchaseId)).toMatchObject({ autoRenew: false });
  });

  it('PK-05 pauses after the last failed try; PK-06 turning renewal off revokes the mandate', async () => {
    const planId = await subscriptionPlan(app(), 'attendant', 6, 300_000);
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    const autoRenew = (enabled: boolean) =>
      server()
        .post(`/v1/me/plans/${purchaseId}/auto-renew`)
        .set(bearer(patient.login))
        .send({ enabled });
    await autoRenew(true).expect(204);
    const renewals = app().get(RenewalsService);
    for (const attempt of [1, 2, 3]) {
      await renewals.charge(purchaseId, attempt);
      await settleLastOrder(app(), 'failed');
    }
    expect(await purchaseRow(app(), purchaseId)).toMatchObject({ paused: true, autoRenew: false });
    expect((await plansOf(app(), patient.login))[0]).toMatchObject({ renewalPaused: true });

    await autoRenew(true).expect(204);
    const mandateId = (await purchaseRow(app(), purchaseId))?.mandateId ?? '';
    await autoRenew(false).expect(204);
    expect(gateway(app()).mandates.get(mandateId)?.active).toBe(false);
    expect(await purchaseRow(app(), purchaseId)).toMatchObject({ mandateId: null });
  });

  it('PK-05 packages do not renew', async () => {
    const planId = await packagePlan(app(), 'nursing_vitals_check', 2, 50_000);
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    const refused = await server()
      .post(`/v1/me/plans/${purchaseId}/auto-renew`)
      .set(bearer(patient.login))
      .send({ enabled: true })
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'plan_not_renewable' });
  });
});
