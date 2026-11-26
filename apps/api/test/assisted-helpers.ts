import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { IDENTITY_CONSENT } from '../src/accounts/consent-versions.js';
import { UPLOAD_CONTENT_TYPE } from '../src/app.factory.js';
import { AssistedSessionRepository } from '../src/assisted-onboarding/assisted-session.repository.js';
import type { AssistedRole } from '../src/assisted-onboarding/assisted-rules.js';
import { AccessTokenStore } from '../src/auth/access-token.store.js';
import { ReverificationStore } from '../src/auth/reverification.js';
import { CHECKLISTS } from '../src/onboarding/checklists.js';
import { type AdminLogin, nextTotp, sms, syntheticMobile } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { REDIS_CLIENT } from '../src/data-stores/data-stores.tokens.js';
import { SYNTHETIC_PDF } from './provider-helpers.js';

export const ASSISTED = '/admin/v1/assisted-onboarding';

/** Proves a fresh TOTP code for the admin's session (AC-05), as the re-verify sheet does. */
export async function adminReverify(app: INestApplication<App>, admin: AdminLogin): Promise<void> {
  // A TOTP step is used once, so an admin who is still fresh does not prove it again.
  const principal = await app.get(AccessTokenStore).resolve(admin.token);
  if (principal && (await app.get(ReverificationStore).isFresh(principal.sessionId))) return;
  await request(app.getHttpServer())
    .post('/admin/v1/auth/reverify')
    .set(bearer(admin))
    .send({ code: nextTotp(admin.secret) })
    .expect(204);
}

/** Asks for the provider's consent code (fresh TOTP assumed). */
export function requestConsent(
  app: INestApplication<App>,
  admin: AdminLogin,
  mobile: string,
  locale = 'en',
) {
  return request(app.getHttpServer())
    .post(`${ASSISTED}/consent`)
    .set(bearer(admin))
    .send({ mobile, locale });
}

/** Sends the code the provider "reads out" (the SMS double's last code for the number). */
export function verifyConsent(
  app: INestApplication<App>,
  admin: AdminLogin,
  sessionId: string,
  code: string | undefined,
) {
  return request(app.getHttpServer())
    .post(`${ASSISTED}/sessions/${sessionId}/consent/verify`)
    .set(bearer(admin))
    .send({ code });
}

/** Re-verifies, requests consent, reads the code from the SMS double and verifies it. */
export async function openAssisted(
  app: INestApplication<App>,
  admin: AdminLogin,
  mobile = syntheticMobile(),
): Promise<{ sessionId: string; mobile: string }> {
  await adminReverify(app, admin);
  const requested = await requestConsent(app, admin, mobile).expect(200);
  const sessionId = (requested.body as { sessionId: string }).sessionId;
  await verifyConsent(app, admin, sessionId, sms(app).lastCodeFor(mobile)).expect(200);
  return { sessionId, mobile };
}

// A synthetic one-pixel PNG header; never a real photo.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1]).toString(
  'base64',
);

/** Synthetic payout details; the UPI id is what tests look for in responses and audit rows. */
export const ASSISTED_PAYOUT = {
  method: 'upi',
  holderName: 'Synthetic Provider',
  upiId: 'synthetic@okbank',
};

/** Makes the admin's TOTP proof stale, as it is five minutes after re-verifying. */
export async function expireReverification(
  app: INestApplication<App>,
  admin: AdminLogin,
): Promise<void> {
  const principal = await app.get(AccessTokenStore).resolve(admin.token);
  if (!principal) throw new Error('Session not found');
  await app.get<Redis>(REDIS_CLIENT).del(`reverified:${principal.sessionId}`);
}

/**
 * Marks the admin's re-verification fresh again without a TOTP code: a code step is used once, so
 * a test that lets the proof lapse inside the same 30 seconds cannot prove it a second time.
 */
export async function restoreReverification(
  app: INestApplication<App>,
  admin: AdminLogin,
): Promise<void> {
  const principal = await app.get(AccessTokenStore).resolve(admin.token);
  if (!principal) throw new Error('Session not found');
  await app.get(ReverificationStore).mark(principal.sessionId);
}

/** A PUT of a file (a synthetic PDF unless `extra` says otherwise) to an assisted upload route. */
export function assistedUpload(
  app: INestApplication<App>,
  admin: AdminLogin,
  sessionId: string,
  path: string,
  extra: object = {},
) {
  return request(app.getHttpServer())
    .put(`${ASSISTED}/sessions/${sessionId}/${path}`)
    .set(bearer(admin))
    .set('Content-Type', UPLOAD_CONTENT_TYPE)
    .send(
      JSON.stringify({ contentType: 'application/pdf', contentBase64: SYNTHETIC_PDF, ...extra }),
    );
}

/** The photo upload body for `assistedUpload(..., 'photo', PHOTO)`. */
export const PHOTO = { contentType: 'image/png', contentBase64: PNG };

/** The fallback identity document with the consent read aloud (KY-07, PR-01). */
export const IDENTITY_DOCUMENT = {
  kind: 'voter_id',
  locale: 'en',
  consentVersion: IDENTITY_CONSENT.version,
  consentReadAloud: true,
};

/** Sets the provider type and basic details; a new account's name is entered here. */
export function assistedDetails(
  app: INestApplication<App>,
  admin: AdminLogin,
  sessionId: string,
  body: object,
) {
  return request(app.getHttpServer())
    .put(`${ASSISTED}/sessions/${sessionId}/details`)
    .set(bearer(admin))
    .send(body);
}

/** Asks for the payout code, saves the destination with it and returns the answer's text. */
export async function savePayoutAssisted(
  app: INestApplication<App>,
  admin: AdminLogin,
  session: { sessionId: string; mobile: string },
  payout: object = ASSISTED_PAYOUT,
): Promise<string> {
  const base = `${ASSISTED}/sessions/${session.sessionId}`;
  await request(app.getHttpServer()).post(`${base}/payout/code`).set(bearer(admin)).expect(200);
  await adminReverify(app, admin);
  const saved = await request(app.getHttpServer())
    .put(`${base}/payout`)
    .set(bearer(admin))
    .send({ ...payout, code: sms(app).lastCodeFor(session.mobile) })
    .expect(200);
  return saved.text;
}

/**
 * The whole assisted journey for a provider type: consent, details, every checklist document,
 * identity document, profile and photo, payout with its own code, and submit. Returns the ended,
 * submitted session.
 */
export async function completeAssisted(
  app: INestApplication<App>,
  admin: AdminLogin,
  role: AssistedRole,
) {
  const session = await openAssisted(app, admin);
  const organisation = role === 'lab' ? { organisationName: 'Synthetic Diagnostics' } : {};
  await assistedDetails(app, admin, session.sessionId, {
    role,
    fullName: 'Synthetic Provider',
    gender: 'female',
    languages: ['or', 'en'],
    adultDeclared: true,
    ...organisation,
  }).expect(200);
  for (const item of CHECKLISTS[role]) {
    await assistedUpload(app, admin, session.sessionId, `documents/${item.key}`, {
      ...(item.reference ? { reference: 'SYN-12345' } : {}),
      ...(item.expiry ? { expiresOn: '2030-01-01' } : {}),
    }).expect(200);
  }
  await assistedUpload(
    app,
    admin,
    session.sessionId,
    'identity-document',
    IDENTITY_DOCUMENT,
  ).expect(200);
  await request(app.getHttpServer())
    .put(`${ASSISTED}/sessions/${session.sessionId}/profile`)
    .set(bearer(admin))
    .send({ qualifications: 'Synthetic qualification', experienceYears: 5 })
    .expect(200);
  await assistedUpload(app, admin, session.sessionId, 'photo', PHOTO).expect(200);
  await savePayoutAssisted(app, admin, session);
  const submitted = await request(app.getHttpServer())
    .post(`${ASSISTED}/sessions/${session.sessionId}/submit`)
    .set(bearer(admin))
    .expect(200);
  const row = await app.get(AssistedSessionRepository).find(session.sessionId, admin.id);
  return { ...session, accountId: row?.accountId ?? '', submitted: submitted.body as unknown };
}
