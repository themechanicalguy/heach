import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type request from 'supertest';
import { REDIS_CLIENT } from '../src/data-stores/data-stores.tokens.js';
import {
  otpSignIn,
  requestCode,
  signedUp,
  sms,
  statusesOf,
  syntheticMobile,
  useApp,
} from './account-helpers.js';
import { bearer, login, USERS } from './auth-helpers.js';
import { captureOutput } from './capture-output.js';

interface Challenge {
  challengeId: string;
  expiresInSeconds: number;
  resendInSeconds: number;
}

const challengeOf = (response: request.Response) => response.body as Challenge;
const EXPIRE_NOW =
  "UPDATE app.otp_challenge SET expires_at = now() - interval '1 second' WHERE id = $1";
const RESEND_NOW =
  "UPDATE app.otp_challenge SET resend_at = now() - interval '1 second' WHERE id = $1";

describe('OTP sign-up and returning sign-in (AC-01, SE-08)', () => {
  const { app, server } = useApp();

  it('AC-01 a new number gets a six-digit code in its language and a new account in setup', async () => {
    const mobile = syntheticMobile();
    const issued = await requestCode(app(), `0${mobile.slice(3)}`);
    expect(issued.status).toBe(200);
    expect(challengeOf(issued)).toMatchObject({ expiresInSeconds: 300, resendInSeconds: 30 });
    expect(issued.headers['cache-control']).toBe('no-store');
    const message = sms(app()).sent.at(-1);
    expect(message).toMatchObject({ to: mobile, locale: 'or', templateId: 'otp_sign_in' });
    expect(message?.params.code).toMatch(/^\d{6}$/);
    const signedIn = await server()
      .post('/v1/auth/otp/verify')
      .send({
        challengeId: challengeOf(issued).challengeId,
        code: message?.params.code,
        locale: 'or',
      });
    expect(String(signedIn.headers['set-cookie'])).toMatch(/heach_refresh=.*HttpOnly.*Secure/);
    const me = await server()
      .get('/v1/me')
      .set('Authorization', `Bearer ${(signedIn.body as { accessToken: string }).accessToken}`);
    expect(me.body).toMatchObject({
      activeRole: 'new_account',
      locale: 'or',
      mobile: `••••••${mobile.slice(-4)}`,
      roles: [],
      setup: { complete: false, nextStep: 'role' },
    });
  });

  it('AC-01 a returning number signs in to the same account, in its granted role', async () => {
    const { mobile } = await signedUp(app());
    const again = await otpSignIn(app(), mobile);
    const me = await server().get('/v1/me').set(bearer(again.login));
    expect(me.body).toMatchObject({ activeRole: 'patient', setup: { complete: true } });
  });

  it('SE-08 known and unknown numbers get the same answer (no enumeration)', async () => {
    const { mobile } = await signedUp(app());
    const known = challengeOf(await requestCode(app(), mobile));
    const unknown = challengeOf(await requestCode(app(), syntheticMobile()));
    expect({ ...known, challengeId: '' }).toEqual({ ...unknown, challengeId: '' });
  });

  it('SE-08 only Indian mobile numbers are accepted', async () => {
    for (const mobile of ['+447946000000', '12345', '5000000000']) {
      const response = await requestCode(app(), mobile);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'mobile_invalid' });
    }
  });
});

describe('OTP failures, expiry and reuse (SE-07, SE-08)', () => {
  const { app, db, server } = useApp();
  const verify = (challengeId: string, code: string | undefined) =>
    server().post('/v1/auth/otp/verify').send({ challengeId, code, locale: 'or' });

  it('SE-08 a wrong code counts; the fifth ends the challenge, even for the right code', async () => {
    const mobile = syntheticMobile();
    const { challengeId } = challengeOf(await requestCode(app(), mobile));
    const right = sms(app()).lastCodeFor(mobile) ?? '';
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      expect((await verify(challengeId, wrong)).body).toMatchObject({ code: 'otp_incorrect' });
    }
    expect((await verify(challengeId, right)).body).toMatchObject({ code: 'otp_expired' });
  });

  it('SE-07 an expired code and an unknown challenge get the same answer', async () => {
    const mobile = syntheticMobile();
    const { challengeId } = challengeOf(await requestCode(app(), mobile));
    await db().query(EXPIRE_NOW, [challengeId]);
    const expired = await verify(challengeId, sms(app()).lastCodeFor(mobile));
    const unknown = await verify(randomUUID(), '123456');
    expect([expired.status, unknown.status]).toEqual([400, 400]);
    expect(expired.body).toMatchObject({ code: 'otp_expired' });
    expect(unknown.body).toMatchObject({ code: 'otp_expired' });
  });

  it('SE-07 a code works once, also when two requests race with it', async () => {
    const mobile = syntheticMobile();
    const { challengeId } = challengeOf(await requestCode(app(), mobile));
    const code = sms(app()).lastCodeFor(mobile);
    expect(
      statusesOf(await Promise.all([verify(challengeId, code), verify(challengeId, code)])),
    ).toEqual([200, 400]);
    expect((await verify(challengeId, code)).status).toBe(400);
  });

  it('L-1 two first sign-ins with one number at once create one account', async () => {
    const mobile = syntheticMobile();
    const first = challengeOf(await requestCode(app(), mobile));
    const firstCode = sms(app()).lastCodeFor(mobile);
    const second = challengeOf(await requestCode(app(), mobile));
    const secondCode = sms(app()).lastCodeFor(mobile);
    const results = await Promise.all([
      verify(first.challengeId, firstCode),
      verify(second.challengeId, secondCode),
    ]);
    expect(statusesOf(results)).toEqual([200, 200]);
    const { rows } = await db().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.account a
         JOIN app.otp_challenge c ON c.mobile_index = a.mobile_index WHERE c.id = $1`,
      [first.challengeId],
    );
    expect(rows[0]?.n).toBe(1);
  });
});

describe('OTP resend and delivery failures (SE-08)', () => {
  const { app, db, server } = useApp();
  const resend = (challengeId: string, locale = 'or') =>
    server().post('/v1/auth/otp/resend').send({ challengeId, locale });

  it('SE-08 a new code only after the cooldown, and the old code then stops working', async () => {
    const mobile = syntheticMobile();
    const { challengeId } = challengeOf(await requestCode(app(), mobile));
    const oldCode = sms(app()).lastCodeFor(mobile);
    const early = await resend(challengeId, 'en');
    expect(early.status).toBe(429);
    expect(Number(early.headers['retry-after'])).toBeGreaterThan(0);
    await db().query(RESEND_NOW, [challengeId]);
    expect((await resend(challengeId, 'en')).status).toBe(200);
    const newCode = sms(app()).lastCodeFor(mobile);
    expect(sms(app()).sent.at(-1)?.locale).toBe('en');
    const verify = (code: string | undefined) =>
      server().post('/v1/auth/otp/verify').send({ challengeId, code, locale: 'en' });
    if (newCode !== oldCode) expect((await verify(oldCode)).status).toBe(400);
    expect((await verify(newCode)).status).toBe(200);
  });

  it('SE-08 at most three resends per challenge', async () => {
    const { challengeId } = challengeOf(await requestCode(app(), syntheticMobile()));
    const again = async () => {
      await db().query(RESEND_NOW, [challengeId]);
      return resend(challengeId);
    };
    for (let i = 0; i < 3; i += 1) expect((await again()).status).toBe(200);
    expect((await again()).body).toMatchObject({ code: 'otp_expired' });
  });

  it('SE-08 a failed SMS closes the challenge and asks the client to retry', async () => {
    sms(app()).failing = true;
    try {
      const response = await requestCode(app(), syntheticMobile());
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'sms_unavailable' });
    } finally {
      sms(app()).failing = false;
    }
    const { rows } = await db().query<{ consumed: boolean }>(
      'SELECT consumed_at IS NOT NULL AS consumed FROM app.otp_challenge ORDER BY created_at DESC LIMIT 1',
    );
    expect(rows[0]?.consumed).toBe(true);
  });
});

describe('OTP data protection and account states (EN-09, LM-02, AD-03, L-1)', () => {
  const { app, db, server } = useApp();
  const output = captureOutput();

  afterAll(() => {
    output.stop();
  });

  it('EN-09 the number is ciphertext with a blind index; the code is a keyed hash; neither is logged', async () => {
    const { mobile } = await signedUp(app());
    const digits = mobile.slice(3);
    const accounts = await db().query<{ row: string }>(
      'SELECT a::text AS row FROM app.account a WHERE NOT synthetic',
    );
    const challenges = await db().query<{ row: string }>(
      'SELECT c::text AS row FROM app.otp_challenge c',
    );
    for (const { row } of [...accounts.rows, ...challenges.rows]) expect(row).not.toContain(digits);
    const lastCode = sms(app()).lastCodeFor(mobile) ?? '';
    expect(output.text()).not.toContain(digits);
    expect(output.text()).not.toContain(lastCode);
  });

  it('AD-03 a suspended account is told so only after a proven code', async () => {
    const { mobile } = await signedUp(app());
    await db().query(
      `UPDATE app.account SET status = 'suspended', suspension_reason = 'other'
        WHERE mobile_index = (SELECT mobile_index FROM app.otp_challenge
                               WHERE purpose = 'sign_in' ORDER BY created_at DESC LIMIT 1)`,
    );
    const { challengeId } = challengeOf(await requestCode(app(), mobile));
    const verify = (code: string | undefined) =>
      server().post('/v1/auth/otp/verify').send({ challengeId, code, locale: 'or' });
    expect((await verify('000000')).body).not.toMatchObject({ code: 'account_suspended' });
    const right = await verify(sms(app()).lastCodeFor(mobile));
    expect(right.status).toBe(403);
    expect(right.body).toMatchObject({ code: 'account_suspended' });
    expect(right.headers['set-cookie']).toBeUndefined();
  });

  it('L-1 test sign-in reaches synthetic accounts only, never an account made by OTP', async () => {
    await signedUp(app());
    const { rows } = await db().query<{ id: string }>(
      'SELECT id FROM app.account WHERE NOT synthetic ORDER BY created_at DESC LIMIT 1',
    );
    const refused = await server().post('/v1/auth/test-login').send({ userId: rows[0]?.id });
    expect(refused.status).toBe(404);
    expect((await login(app(), USERS.patientA)).token).toBeTruthy();
  });
});

describe('OTP caps per number (SE-08)', () => {
  const { app } = useApp({ OTP_SENDS_PER_NUMBER_PER_HOUR: '2' });

  it('SE-08 a number gets at most its hourly sends', async () => {
    const mobile = syntheticMobile();
    expect((await requestCode(app(), mobile)).status).toBe(200);
    expect((await requestCode(app(), mobile)).status).toBe(200);
    const third = await requestCode(app(), mobile);
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ code: 'otp_rate_limited' });
    expect(Number(third.headers['retry-after'])).toBeGreaterThan(0);
    expect(JSON.stringify(third.body)).not.toContain(mobile.slice(3));
  });
});

describe('OTP caps per device (SE-08)', () => {
  const { app } = useApp({ OTP_SENDS_PER_DEVICE_PER_HOUR: '2' });

  it('SE-08 a device cookie gets at most its hourly sends, whatever the number', async () => {
    const device = randomUUID();
    const send = (from: string) => requestCode(app(), syntheticMobile(), from);
    expect([(await send(device)).status, (await send(device)).status]).toEqual([200, 200]);
    expect((await send(device)).status).toBe(429);
    expect((await send(randomUUID())).status).toBe(200);
  });
});

describe('OTP caps on wrong codes per address (SE-08)', () => {
  const { app, server } = useApp({ OTP_FAILURES_PER_ADDRESS_PER_HOUR: '3' });
  // Other suites share Redis: this address's failure count starts from zero.
  const clearFailures = async () => {
    const redis = app().get<Redis>(REDIS_CLIENT);
    for (const key of await redis.keys('otp-cap:fail-h:*')) await redis.del(key);
  };

  it('SE-08 an address that sends too many wrong codes is stopped for the hour', async () => {
    await clearFailures();
    const mobile = syntheticMobile();
    const { challengeId } = challengeOf(await requestCode(app(), mobile));
    const verify = (code: string | undefined) =>
      server().post('/v1/auth/otp/verify').send({ challengeId, code, locale: 'or' });
    for (let i = 0; i < 3; i += 1) expect((await verify('000000')).status).toBe(400);
    expect((await verify(sms(app()).lastCodeFor(mobile))).status).toBe(429);
    await clearFailures();
  });
});
