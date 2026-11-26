import type pg from 'pg';
import { PG_POOL } from '../src/data-stores/data-stores.tokens.js';
import { withTransaction } from '../src/data-stores/transaction.js';
import { LedgerService } from '../src/payouts/ledger.service.js';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { bookingOf, firstSlot, gateway, paidBooking, pay, runJobs } from './booking-helpers.js';
import { listedProvider } from './provider-helpers.js';

/**
 * A gateway outage part-way through a run of refunds or transfers (PY-02, PY-05): what was sent
 * stays sent and is never sent again; what was not is retried by the job until it goes through.
 */
describe('Gateway outages mid-run (PY-02, PY-05)', () => {
  const { app, server, db } = useApp();

  afterEach(() => {
    gateway(app()).refundsBeforeOutage = undefined;
    gateway(app()).failingTransfers = false;
  });

  it('PY-02 a refund split over two payments survives an outage after the first, without paying twice', async () => {
    const attendant = await listedProvider(app(), 'attendant', 'attendant_24h', {
      feePaise: 100_000,
    });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: attendant.listingId,
      startsAt: await firstSlot(app(), attendant.accountId, attendant.listingId),
      shiftDays: 3,
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(attendant.login))
      .expect(204);
    const balance = await server()
      .post(`/v1/bookings/${booking.id}/balance`)
      .set(bearer(patient.login))
      .expect(200);
    await pay(app(), patient.login, (balance.body as { orderId: string }).orderId);

    const refundsBefore = gateway(app()).refunds.length;
    gateway(app()).refundsBeforeOutage = 1;
    const support = await adminSignIn(app(), 'support');
    await server()
      .post(`/admin/v1/bookings/${booking.id}/cancel`)
      .set(bearer(support))
      .send({ reason: 'admin_decision' })
      .expect(204);

    const halfway = await bookingOf(app(), patient.login, booking.id);
    expect(gateway(app()).refunds.length - refundsBefore).toBe(1);
    expect(halfway.status).toBe('cancelled');
    expect(halfway.fees.refundedPaise).toBeGreaterThan(0);
    expect(halfway.fees.refundedPaise).toBeLessThan(300_000);

    gateway(app()).refundsBeforeOutage = undefined;
    await runJobs(app());
    await runJobs(app());

    const sent = gateway(app()).refunds.slice(refundsBefore);
    expect(sent).toHaveLength(2);
    expect(sent.reduce((sum, refund) => sum + refund.amountPaise, 0)).toBe(300_000);
    const done = await bookingOf(app(), patient.login, booking.id);
    expect(done.status).toBe('refunded');
    expect(done.fees.refundedPaise).toBe(300_000);
  });

  it('PY-05 transfers refused by the gateway are retried, and each provider is paid exactly once', async () => {
    const first = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    const second = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    const ledger = app().get(LedgerService);
    const pool = app().get<pg.Pool>(PG_POOL);
    const patient = await signedUp(app());
    for (const [index, nurse] of [first, second].entries()) {
      const booking = await paidBooking(app(), patient.login, {
        listingId: nurse.listingId,
        startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId, index),
      });
      await withTransaction(pool, (client) =>
        ledger.earn(client, {
          providerId: nurse.accountId,
          bookingId: booking.id,
          amountPaise: 20_000 + index,
          kind: 'earning',
          at: new Date(Date.now() - 72 * 3_600_000),
        }),
      );
    }
    const ours = () =>
      gateway(app()).transfers.filter((transfer) =>
        [first.accountId, second.accountId].includes(transfer.providerId),
      );

    gateway(app()).failingTransfers = true;
    const run = await ledger.runPayouts(new Date());
    expect(ours()).toHaveLength(0);
    const pending = await db().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.payout_transfer WHERE payout_run_id = $1 AND status = 'pending'`,
      [run.runId],
    );
    expect(pending.rows[0]?.n).toBe(run.providers);

    gateway(app()).failingTransfers = false;
    await runJobs(app());
    await runJobs(app());
    expect(
      ours()
        .map((transfer) => transfer.amountPaise)
        .sort((a, b) => a - b),
    ).toEqual([20_000, 20_001]);
    const references = ours().map((transfer) => transfer.reference);
    expect(new Set(references).size).toBe(2);
    expect(references).not.toContain(run.runId);
  });
});

describe('Provider earnings (PY-04)', () => {
  const { app, server, db } = useApp();

  it('PY-04 earnings totals count the whole ledger, not only the lines shown', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    await db().query(
      `INSERT INTO app.ledger_entry (id, provider_account_id, kind, amount_paise, available_at)
       SELECT gen_random_uuid(), $1, 'reversal', -1, now() FROM generate_series(1, 250)`,
      [nurse.accountId],
    );
    const earnings = await server()
      .get('/v1/provider/earnings')
      .set(bearer(nurse.login))
      .expect(200);
    const body = earnings.body as { balancePaise: number; lines: unknown[] };
    expect(body.lines.length).toBeLessThan(250);
    expect(body.balancePaise).toBe(-250);
  });
});
