import type { FakeSmsSender } from '../src/adapters/fakes.js';
import { SMS_SENDER } from '../src/adapters/sms.port.js';
import { smsText } from '../src/adapters/sms-text.js';
import { Notifier } from '../src/notifications/notifier.service.js';
import { adminSignIn, nextTotp, signedUp, useApp } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import { completedVisit, runJobs } from './booking-helpers.js';
import { accountIdOf, listedProvider } from './provider-helpers.js';

describe('Content without a deployment (AD-09)', () => {
  const { app, server, db } = useApp();

  const reverified = async (role: 'super_admin' | 'support') => {
    const admin = await adminSignIn(app(), role);
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(admin))
      .send({ code: nextTotp(admin.secret) })
      .expect(204);
    return admin;
  };

  it('AD-09 an edited template keeps its placeholders and is what the patient receives', async () => {
    const admin = await reverified('super_admin');
    const templates = (
      await server().get('/admin/v1/content/templates').set(bearer(admin)).expect(200)
    ).body as { template: string; locale: string; placeholders: string[] }[];
    expect(templates).toContainEqual(
      expect.objectContaining({ template: 'plan_expiring', locale: 'en', placeholders: ['time'] }),
    );
    expect(templates.some((row) => row.template.startsWith('otp_'))).toBe(false);
    const put = (text: string | null) =>
      server()
        .put('/admin/v1/content/templates/plan_expiring/en')
        .set(bearer(admin))
        .send({ text });
    expect((await put('Your plan ends soon.').expect(400)).body).toMatchObject({
      code: 'template_placeholders',
    });
    await put('Your HEACH care plan ends {time}. See what is left in the app.').expect(204);
    await server()
      .put('/admin/v1/content/templates/otp_sign_in/en')
      .set(bearer(admin))
      .send({ text: '{code} {minutes}' })
      .expect(404);

    const patient = await signedUp(app());
    const accountId = await accountIdOf(app(), patient.login);
    await db().query(`UPDATE app.account SET preferred_locale = 'en' WHERE id = $1`, [accountId]);
    await app()
      .get(Notifier)
      .notify(accountId, 'plan_expiring', { time: '2026-12-01T04:30:00.000Z' });
    const sent = app().get<FakeSmsSender>(SMS_SENDER).sent.at(-1);
    expect(sent && smsText(sent)).toMatch(/^Your HEACH care plan ends /);
    const notes = (
      await server().get('/v1/me/notifications?locale=en').set(bearer(patient.login)).expect(200)
    ).body as { template: string; override: string | null }[];
    expect(notes[0]?.override).toMatch(/care plan/);
    await put(null).expect(204);
  });

  it('AD-09 static pages per language; only a super admin changes them', async () => {
    const admin = await reverified('super_admin');
    await server()
      .put('/admin/v1/content/pages/faq/hi')
      .set(bearer(admin))
      .send({ title: 'सवाल और जवाब', body: 'पहला पैराग्राफ़।\n\nदूसरा पैराग्राफ़।' })
      .expect(204);
    const page = (await server().get('/v1/pages/faq?locale=hi').expect(200)).body as {
      title: string;
    };
    expect(page.title).toBe('सवाल और जवाब');
    await server().get('/v1/pages/nowhere?locale=hi').expect(404);
    const support = await reverified('support');
    await server()
      .put('/admin/v1/content/pages/faq/en')
      .set(bearer(support))
      .send({ title: 'FAQ', body: 'Text' })
      .expect(403);
  });
});

describe('Provider referral (RR-04, RR-05)', () => {
  const { app, server, db } = useApp();

  const codeOf = async (login: Login) =>
    (
      (await server().get('/v1/me/referral').set(bearer(login)).expect(200)).body as {
        code: string;
      }
    ).code;

  it('RR-04 an invited provider qualifies; the referrer earns commission back on later bookings', async () => {
    const referrer = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', {
      feePaise: 40_000,
    });
    const invited = await listedProvider(app(), 'nurse', 'nursing_vitals_check', {
      feePaise: 30_000,
    });
    const patient = await signedUp(app());
    const patientCode = await codeOf(patient.login);
    const referrerCode = await codeOf(referrer.login);
    // A provider joins only with another provider's code.
    const refused = await server()
      .post('/v1/me/referral/join')
      .set(bearer(invited.login))
      .send({ code: patientCode })
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'referral_not_allowed' });
    await server()
      .post('/v1/me/referral/join')
      .set(bearer(invited.login))
      .send({ code: referrerCode })
      .expect(204);

    await db().query(`UPDATE app.setting SET value = 1 WHERE key = 'provider_referral_bookings'`);
    try {
      await completedVisit(app(), db(), patient.login, invited);
      await runJobs(app());
    } finally {
      await db().query(`UPDATE app.setting SET value = 5 WHERE key = 'provider_referral_bookings'`);
    }
    const credit = async () =>
      (
        (await server().get('/v1/me/referral').set(bearer(referrer.login)).expect(200)).body as {
          commissionCreditBookings: number;
        }
      ).commissionCreditBookings;
    expect(await credit()).toBe(10);

    const bookingId = await completedVisit(app(), db(), patient.login, referrer, 1);
    await runJobs(app());
    const { rows } = await db().query<{ amount: number }>(
      `SELECT amount_paise AS amount FROM app.ledger_entry WHERE booking_id = $1 AND kind = 'commission_rebate'`,
      [bookingId],
    );
    // Commission is 15 % of ₹400; half of it comes back.
    expect(rows).toEqual([{ amount: 3_000 }]);
    expect(await credit()).toBe(9);
  });
});
