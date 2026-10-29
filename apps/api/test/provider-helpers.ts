import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { UPLOAD_CONTENT_TYPE } from '../src/app.factory.js';
import { AccessTokenStore } from '../src/auth/access-token.store.js';
import { CHECKLISTS, type OnboardingRole } from '../src/onboarding/checklists.js';
import { adminSignIn, reverify, signedUp } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';

/** The account behind a session, read from the token store as the guard would. */
export async function accountIdOf(app: INestApplication<App>, login: Login): Promise<string> {
  const principal = await app.get(AccessTokenStore).resolve(login.token);
  if (!principal) throw new Error('Session not found');
  return principal.userId;
}

/** A synthetic one-page PDF as base64 (never a real document). */
export const SYNTHETIC_PDF = Buffer.from('%PDF-1.7\n% synthetic test document\n').toString(
  'base64',
);

export function uploadDocument(
  app: INestApplication<App>,
  login: Login,
  item: string,
  extra: object = {},
) {
  return request(app.getHttpServer())
    .put(`/v1/provider/application/documents/${item}`)
    .set(bearer(login))
    .set('Content-Type', UPLOAD_CONTENT_TYPE)
    .send(
      JSON.stringify({ contentType: 'application/pdf', contentBase64: SYNTHETIC_PDF, ...extra }),
    );
}

/** Identity through the fake partner: start, follow the redirect's code back, complete. */
export async function verifyIdentity(app: INestApplication<App>, login: Login): Promise<void> {
  const started = await request(app.getHttpServer())
    .post('/v1/provider/application/identity/start')
    .set(bearer(login))
    .send({ locale: 'en' })
    .expect(200);
  const back = new URL((started.body as { redirectUrl: string }).redirectUrl);
  await request(app.getHttpServer())
    .post('/v1/provider/application/identity/complete')
    .set(bearer(login))
    .send({ code: back.searchParams.get('code'), reference: back.searchParams.get('ref') })
    .expect(200);
}

/** A provider with every checklist item, identity and payout details, then submitted. */
export async function submittedProvider(app: INestApplication<App>, role: OnboardingRole) {
  const setup = role === 'lab' ? { organisationName: 'Synthetic Diagnostics' } : {};
  const { mobile, login } = await signedUp(app, { role, languages: ['or', 'en'], ...setup });
  for (const item of CHECKLISTS[role]) {
    await uploadDocument(app, login, item.key, {
      ...(item.reference ? { reference: 'SYN-12345' } : {}),
      ...(item.expiry ? { expiresOn: '2030-01-01' } : {}),
    }).expect(200);
  }
  await verifyIdentity(app, login);
  if (role !== 'sample_collector') {
    await reverify(app, mobile, login);
    await request(app.getHttpServer())
      .put('/v1/provider/application/payout')
      .set(bearer(login))
      .send({ method: 'upi', holderName: 'Synthetic Provider', upiId: 'synthetic@okbank' })
      .expect(200);
  }
  await request(app.getHttpServer())
    .post('/v1/provider/application/submit')
    .set(bearer(login))
    .expect(200);
  return { mobile, login, accountId: await accountIdOf(app, login) };
}

/** A provider of this type, submitted and approved by a verifier (J1 then J5). */
export async function approvedProvider(app: INestApplication<App>, role: OnboardingRole) {
  const provider = await submittedProvider(app, role);
  const verifier = await adminSignIn(app, 'verifier');
  const server = request(app.getHttpServer());
  await server
    .get(`/admin/v1/applications/${provider.accountId}`)
    .set(bearer(verifier))
    .expect(200);
  await request(app.getHttpServer())
    .post(`/admin/v1/applications/${provider.accountId}/decision`)
    .set(bearer(verifier))
    .send({ decision: 'approve' })
    .expect(204);
  return provider;
}

export const PILOT_PIN = '751001';
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 0,
  endMinute: 1440,
}));

/** An Approved provider listing one catalogue item in the pilot PIN, open all week (Step 4). */
export async function listedProvider(
  app: INestApplication<App>,
  role: OnboardingRole,
  item: string,
  options: { feePaise?: number; pins?: string[]; bufferMinutes?: number } = {},
) {
  const provider = await approvedProvider(app, role);
  const server = () => request(app.getHttpServer());
  await server()
    .put(`/v1/provider/listings/${item}`)
    .set(bearer(provider.login))
    .send({
      feePaise: options.feePaise ?? 60_000,
      durationMinutes: role === 'attendant' ? 720 : 45,
      active: true,
      careSettings: role === 'attendant' ? ['home'] : [],
      homeCollection: true,
    })
    .expect(200);
  await server()
    .put('/v1/provider/service-area')
    .set(bearer(provider.login))
    .send({ pins: options.pins ?? [PILOT_PIN], travelSurchargePaise: 5_000 })
    .expect(200);
  await server()
    .put('/v1/provider/availability')
    .set(bearer(provider.login))
    .send({ rules: EVERY_DAY, bufferMinutes: options.bufferMinutes ?? 15 })
    .expect(200);
  const listings = await server()
    .get('/v1/provider/listings')
    .set(bearer(provider.login))
    .expect(200);
  const listing = (
    listings.body as { items: { code: string; listing: { id: string } | null }[] }
  ).items.find((entry) => entry.code === item)?.listing;
  if (!listing) throw new Error('Listing not saved');
  return { ...provider, listingId: listing.id };
}
