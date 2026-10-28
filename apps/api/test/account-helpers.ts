import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { FakeSmsSender } from '../src/adapters/fakes.js';
import { SMS_SENDER } from '../src/adapters/sms.port.js';
import { CURRENT_CONSENT_VERSIONS } from '../src/accounts/consent-versions.js';
import { AdminAccountRepository } from '../src/admin/admin-account.repository.js';
import { hashPassword } from '../src/admin/password.js';
import { stepAt, totpAt } from '../src/admin/totp.js';
import type { AdminRole } from '../src/common/request-context.js';
import { bearer, fromResponse, type Login } from './auth-helpers.js';
import { bootApp } from './boot-app.js';
import { connectAs } from './db.js';

/**
 * A random synthetic Indian mobile number. Nothing is ever sent: tests bind the SMS double, and
 * local runs deliver to Mailpit on this machine only.
 */
export function syntheticMobile(): string {
  return `+9190${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
}

export const sms = (app: INestApplication<App>) => app.get<FakeSmsSender>(SMS_SENDER);

export const CURRENT_CONSENTS = [
  { purpose: 'terms', version: CURRENT_CONSENT_VERSIONS.terms },
  { purpose: 'privacy', version: CURRENT_CONSENT_VERSIONS.privacy },
];

export function requestCode(
  app: INestApplication<App>,
  mobile: string,
  device?: string,
): request.Test {
  const call = request(app.getHttpServer()).post('/v1/auth/otp').send({ mobile, locale: 'or' });
  return device ? call.set('Cookie', `heach_device=${device}`) : call;
}

/** Signs in by OTP, reading the code from the SMS double, as a phone would. */
export async function otpSignIn(app: INestApplication<App>, mobile = syntheticMobile()) {
  const challenge = await requestCode(app, mobile).expect(200);
  const code = sms(app).lastCodeFor(mobile);
  const response = await request(app.getHttpServer())
    .post('/v1/auth/otp/verify')
    .send({
      challengeId: (challenge.body as { challengeId: string }).challengeId,
      code,
      locale: 'or',
    })
    .expect(200);
  return { mobile, login: fromResponse(response) };
}

const PATIENT_SETUP = {
  role: 'patient',
  fullName: 'Synthetic Person',
  gender: 'female',
  adultDeclared: true,
};

/** A new account through setup in the given role; returns a session acting in that role. */
export async function signedUp(
  app: INestApplication<App>,
  setup: Record<string, unknown> = {},
): Promise<{ mobile: string; login: Login }> {
  const { mobile, login } = await otpSignIn(app);
  await request(app.getHttpServer())
    .put('/v1/me/setup')
    .set(bearer(login))
    .send({ ...PATIENT_SETUP, ...setup })
    .expect(204);
  const done = await request(app.getHttpServer())
    .post('/v1/me/setup/complete')
    .set(bearer(login))
    .send({ consents: CURRENT_CONSENTS })
    .expect(200);
  return { mobile, login: { ...login, token: (done.body as { accessToken: string }).accessToken } };
}

/** Proves a fresh OTP for this session (AC-05). */
export async function reverify(app: INestApplication<App>, mobile: string, login: Login) {
  const started = await request(app.getHttpServer())
    .post('/v1/auth/reverify')
    .set(bearer(login))
    .expect(200);
  await request(app.getHttpServer())
    .post('/v1/auth/reverify/verify')
    .set(bearer(login))
    .send({
      challengeId: (started.body as { challengeId: string }).challengeId,
      code: sms(app).lastCodeFor(mobile),
    })
    .expect(204);
}

export const ADMIN_PASSWORD = 'synthetic-admin-password';

export interface AdminLogin extends Login {
  id: string;
  secret: string;
}

/** A new synthetic admin of this sub-role, enrolled in TOTP and signed in (AD-01). */
export async function adminSignIn(
  app: INestApplication<App>,
  role: AdminRole,
): Promise<AdminLogin> {
  const email = `${role}-${randomUUID()}@heach.invalid`;
  const id = await app
    .get(AdminAccountRepository)
    .create({ email, passwordHash: await hashPassword(ADMIN_PASSWORD), role });
  const password = await request(app.getHttpServer())
    .post('/admin/v1/auth/password')
    .send({ email, password: ADMIN_PASSWORD })
    .expect(200);
  const { mfaTicket, enrolment } = password.body as {
    mfaTicket: string;
    enrolment: { secret: string };
  };
  const response = await request(app.getHttpServer())
    .post('/admin/v1/auth/mfa')
    .send({ mfaTicket, code: totpAt(enrolment.secret, stepAt(Date.now())) })
    .expect(200);
  return { ...fromResponse(response), id, secret: enrolment.secret };
}

/** A TOTP code for a later step than any used yet (one step of drift is allowed). */
export const nextTotp = (secret: string) => totpAt(secret, stepAt(Date.now()) + 1);

/** Boots one app (and an admin database connection) for the calling describe block. */
export function useApp(overrides: Record<string, string> = {}): {
  app: () => INestApplication<App>;
  db: () => pg.Client;
  server: () => ReturnType<typeof request>;
} {
  let app: INestApplication<App> | undefined;
  let db: pg.Client | undefined;
  beforeAll(async () => {
    app = await bootApp('test', overrides);
    db = await connectAs('admin');
  });
  afterAll(async () => {
    await db?.end();
    await app?.close();
  });
  const appOf = () => {
    if (!app) throw new Error('App not booted');
    return app;
  };
  return {
    app: appOf,
    db: () => {
      if (!db) throw new Error('Database not connected');
      return db;
    },
    server: () => request(appOf().getHttpServer()),
  };
}

/** Statuses of racing requests, lowest first. */
export const statusesOf = (responses: request.Response[]) =>
  responses.map((response) => response.status).sort((a, b) => a - b);
