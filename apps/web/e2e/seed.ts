import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { createAdmin, PASSWORD, totp } from '../../admin/e2e/admin-helpers';
import { codeFor, inboxOf, syntheticMobile } from './otp-helpers';

/**
 * Data for the browser journeys (J3 to J9), made through the API as other people would: a
 * provider through onboarding and admin approval, plans by an admin. The patient's own steps stay
 * in the browser. Synthetic data only; needs the API, database and Mailpit (E2E_API=1).
 */
const API = process.env.E2E_API_ORIGIN ?? 'http://localhost:3001';
export const PILOT_PIN = '751001';
const PDF = Buffer.from('%PDF-1.7\n% synthetic e2e document\n').toString('base64');
const UPLOAD = 'application/vnd.heach.upload+json';

/** A word unique to this run, letters only (names refuse digits). */
const uniqueWord = () =>
  Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz'[randomInt(0, 26)]).join('');

export interface Session {
  mobile: string;
  token: string;
}

async function call<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown; contentType?: string } = {},
): Promise<T> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.body === undefined
        ? {}
        : { 'content-type': init.contentType ?? 'application/json' }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (!response.ok) {
    // Only the stable reason code, never the body: it could carry synthetic personal data.
    const { code } = (await response.json().catch(() => ({}))) as { code?: string };
    throw new Error(`${method} ${path} answered ${String(response.status)} ${code ?? ''}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Signs in by OTP through the API, reading the code from the local SMS inbox. */
async function otpSession(mobile = syntheticMobile()): Promise<Session> {
  const before = await inboxOf(mobile);
  const { challengeId } = await call<{ challengeId: string }>('/v1/auth/otp', {
    body: { mobile, locale: 'en' },
  });
  const { accessToken } = await call<{ accessToken: string }>('/v1/auth/otp/verify', {
    body: { challengeId, code: await codeFor(mobile, before), locale: 'en' },
  });
  return { mobile, token: accessToken };
}

async function reverify(session: Session): Promise<void> {
  const before = await inboxOf(session.mobile);
  const { challengeId } = await call<{ challengeId: string }>('/v1/auth/reverify', {
    token: session.token,
    body: {},
  });
  await call('/v1/auth/reverify/verify', {
    token: session.token,
    body: { challengeId, code: await codeFor(session.mobile, before) },
  });
}

/** A signed-in admin of this sub-role, made with the operator CLI and enrolled in TOTP. */
export async function adminToken(role: 'super_admin' | 'verifier'): Promise<string> {
  const email = createAdmin(role);
  const { mfaTicket, enrolment } = await call<{
    mfaTicket: string;
    enrolment: { secret: string };
  }>('/admin/v1/auth/password', { body: { email, password: PASSWORD } });
  const { accessToken } = await call<{ accessToken: string }>('/admin/v1/auth/mfa', {
    body: { mfaTicket, code: totp(enrolment.secret) },
  });
  return accessToken;
}

const CHECKLISTS = {
  nurse: ['nursing_registration', 'qualification_certificate', 'police_verification'],
  attendant: ['address_proof', 'reference_letter', 'training_certificate', 'police_verification'],
  lab: ['establishment_registration', 'nabl_certificate'],
} as const;
const WITH_REFERENCE = new Set([
  'nursing_registration',
  'police_verification',
  'establishment_registration',
  'nabl_certificate',
]);

export interface Provider extends Session {
  accountId: string;
  listingId: string;
  name: string;
}

/** A provider through J1 and J5: setup, documents, identity, payout, submit, approval, listing. */
export async function listedProvider(
  role: keyof typeof CHECKLISTS,
  item: string,
  feePaise = 60_000,
): Promise<Provider> {
  const name = `Synthetic ${role} ${uniqueWord()}`;
  const first = await otpSession();
  await call('/v1/me/setup', {
    method: 'PUT',
    token: first.token,
    body: {
      role,
      fullName: name,
      gender: 'female',
      adultDeclared: true,
      languages: ['or', 'en'],
      ...(role === 'lab' ? { organisationName: `Synthetic Diagnostics ${name}` } : {}),
    },
  });
  const { accessToken } = await call<{ accessToken: string }>('/v1/me/setup/complete', {
    token: first.token,
    body: { consents: await consentsDue(first.token) },
  });
  const session = { mobile: first.mobile, token: accessToken };
  for (const key of CHECKLISTS[role]) {
    await call(`/v1/provider/application/documents/${key}`, {
      method: 'PUT',
      token: session.token,
      contentType: UPLOAD,
      body: {
        contentType: 'application/pdf',
        contentBase64: PDF,
        ...(WITH_REFERENCE.has(key) ? { reference: 'SYN-12345', expiresOn: '2030-01-01' } : {}),
      },
    });
  }
  const { redirectUrl } = await call<{ redirectUrl: string }>(
    '/v1/provider/application/identity/start',
    { token: session.token, body: { locale: 'en' } },
  );
  const back = new URL(redirectUrl);
  await call('/v1/provider/application/identity/complete', {
    token: session.token,
    body: { code: back.searchParams.get('code'), reference: back.searchParams.get('ref') },
  });
  await reverify(session);
  await call('/v1/provider/application/payout', {
    method: 'PUT',
    token: session.token,
    body: { method: 'upi', holderName: name, upiId: 'synthetic@okbank' },
  });
  await call('/v1/provider/application/submit', { token: session.token, body: {} });
  const verifier = await adminToken('verifier');
  const queue = await call<{ accountId: string; fullName: string | null }[]>(
    '/admin/v1/applications',
    { token: verifier },
  );
  const accountId = queue.find((row) => row.fullName === name)?.accountId ?? '';
  await call(`/admin/v1/applications/${accountId}`, { token: verifier });
  await call(`/admin/v1/applications/${accountId}/decision`, {
    token: verifier,
    body: { decision: 'approve' },
  });
  return { ...session, accountId, name, listingId: await list(session, role, item, feePaise) };
}

const DURATION_MINUTES: Record<string, number> = { attendant: 720, lab: 15 };

async function list(session: Session, role: string, item: string, feePaise: number) {
  const attendant = role === 'attendant';
  await call(`/v1/provider/listings/${item}`, {
    method: 'PUT',
    token: session.token,
    body: {
      feePaise,
      durationMinutes: DURATION_MINUTES[role] ?? 45,
      active: true,
      careSettings: attendant ? ['home'] : [],
      homeCollection: true,
    },
  });
  await call('/v1/provider/service-area', {
    method: 'PUT',
    token: session.token,
    body: { pins: [PILOT_PIN], travelSurchargePaise: 5_000 },
  });
  await call('/v1/provider/availability', {
    method: 'PUT',
    token: session.token,
    body: {
      rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 0, endMinute: 1440 })),
      bufferMinutes: 15,
    },
  });
  const { items } = await call<{ items: { code: string; listing: { id: string } | null }[] }>(
    '/v1/provider/listings',
    { token: session.token },
  );
  const listing = items.find((entry) => entry.code === item)?.listing;
  if (!listing) throw new Error('Listing not saved');
  return listing.id;
}

async function consentsDue(token: string): Promise<unknown> {
  return (await call<{ consentsDue: unknown }>('/v1/me', { token })).consentsDue;
}

/** The provider's newest request: accepts it and returns the booking ID. */
export async function acceptNewest(provider: Session): Promise<string> {
  const requests = await call<{ bookingId: string }[]>('/v1/provider/requests', {
    token: provider.token,
  });
  const id = requests[0]?.bookingId;
  if (!id) throw new Error('No request arrived');
  await call(`/v1/provider/requests/${id}/accept`, { token: provider.token, body: {} });
  return id;
}

/** Moves a booking and its shifts to start `minutes` from now, so it can begin (local and test). */
export function startSoon(bookingId: string, minutes = 5): void {
  execFileSync(
    process.execPath,
    ['--env-file-if-exists=../../.env', 'e2e-support/move-booking.mjs', bookingId, String(minutes)],
    { cwd: '../api', stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

/** The provider starts the visit with the patient's code and completes it with notes. */
export async function startAndComplete(provider: Session, bookingId: string, code: string) {
  await call(`/v1/provider/bookings/${bookingId}/start`, { token: provider.token, body: { code } });
  await call(`/v1/provider/bookings/${bookingId}/complete`, {
    token: provider.token,
    body: { procedure: 'Synthetic procedure', observations: 'Synthetic', advice: 'Rest' },
  });
}

/** A platform package plan, live at once, created by a super admin (PK-01). */
export async function packagePlan(itemCode: string, units: number, pricePaise: number) {
  const admin = await adminToken('super_admin');
  const name = `Synthetic pack ${uniqueWord()}`;
  const text = { name, inclusions: 'Synthetic home visits', exclusions: 'Medicines' };
  await call('/admin/v1/plans', {
    token: admin,
    body: {
      kind: 'package',
      itemCode,
      units,
      discountPercent: 0,
      familyMembers: 0,
      validityDays: 60,
      pricePaise,
      texts: { or: text, en: text, hi: text },
    },
  });
  return name;
}

/** The lab takes the walk-in sample with the patient's code, receives it and uploads the report. */
export async function labCollectAndReport(lab: Session, bookingId: string, code: string) {
  const { sampleId } = await call<{ sampleId: string }>(
    `/v1/provider/lab/orders/${bookingId}/collect`,
    { token: lab.token, body: { code } },
  );
  await call(`/v1/provider/lab/orders/${bookingId}/received`, { token: lab.token, body: {} });
  await call(`/v1/provider/lab/orders/${bookingId}/report`, {
    token: lab.token,
    contentType: UPLOAD,
    body: { contentType: 'application/pdf', contentBase64: PDF, sampleId },
  });
}

/** The attendant checks in to or out of a shift with the patient's code (HS-03). */
export async function shiftCheck(
  attendant: Session,
  bookingId: string,
  day: number,
  move: 'check-in' | 'check-out',
  code: string,
) {
  await call(`/v1/provider/bookings/${bookingId}/shifts/${String(day)}/${move}`, {
    token: attendant.token,
    body: { code },
  });
}
