// Providers through the real journey (J1, J5): setup, documents, identity, payout, submit, then an
// admin's decision, then listings, service area and weekly hours.
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { UPLOAD, as, asAdmin, completeSetup, reverify, signIn } from './client.mjs';
import { cityPins } from './db.mjs';
import { feePaise, itemsFor } from './data.mjs';

const PDF = Buffer.from('%PDF-1.7\n% synthetic demo document\n').toString('base64');

const DOCUMENTS = {
  physiotherapist: ['qualification_certificate', 'council_registration', 'police_verification'],
  nurse: ['nursing_registration', 'qualification_certificate', 'police_verification'],
  attendant: ['address_proof', 'reference_letter', 'training_certificate', 'police_verification'],
  lab: ['establishment_registration', 'nabl_certificate'],
};
const WITH_REFERENCE = new Set([
  'council_registration',
  'nursing_registration',
  'police_verification',
  'establishment_registration',
  'nabl_certificate',
]);

/** Signs up and submits a complete application; returns the provider's session. */
export async function apply(person) {
  const session = await signIn(person.mobile);
  await completeSetup(session, {
    role: person.role,
    fullName: person.name,
    gender: person.gender,
    languages: person.languages ?? ['or', 'en'],
    ...(person.organisation ? { organisationName: person.organisation } : {}),
  });
  await uploadDocuments(session, person.role);
  await proveIdentity(session);
  await reverify(session);
  await as(session, '/v1/provider/application/payout', {
    method: 'PUT',
    body: {
      method: 'upi',
      holderName: person.name,
      upiId: `demo${person.mobile.slice(-4)}@okbank`,
    },
  });
  await as(session, '/v1/provider/application/submit', { body: {} });
  return session;
}

async function uploadDocuments(session, role) {
  for (const key of DOCUMENTS[role]) {
    const reference = `DEMO-${session.mobile.slice(-4)}-${key.slice(0, 3).toUpperCase()}`;
    await as(session, `/v1/provider/application/documents/${key}`, {
      method: 'PUT',
      contentType: UPLOAD,
      body: {
        contentType: 'application/pdf',
        contentBase64: PDF,
        ...(WITH_REFERENCE.has(key) ? { reference, expiresOn: '2030-03-31' } : {}),
      },
    });
  }
}

/** DigiLocker through the identity test double: the redirect carries the code back. */
async function proveIdentity(session) {
  const { redirectUrl } = await as(session, '/v1/provider/application/identity/start', {
    body: { locale: 'en' },
  });
  const back = new URL(redirectUrl);
  await as(session, '/v1/provider/application/identity/complete', {
    body: { code: back.searchParams.get('code'), reference: back.searchParams.get('ref') },
  });
}

/** The verifier opens the application and approves it, as in the admin review panel (AD-02). */
export async function approve(verifier, name) {
  const queue = await asAdmin(verifier, '/admin/v1/applications');
  const accountId = queue.find(
    (row) => row.fullName === name && row.status === 'submitted',
  )?.accountId;
  if (!accountId) throw new Error('Application not in the queue');
  await asAdmin(verifier, `/admin/v1/applications/${accountId}`);
  await asAdmin(verifier, `/admin/v1/applications/${accountId}/decision`, {
    body: { decision: 'approve' },
  });
  return accountId;
}

const DURATION = { physiotherapist: 45, nurse: 30, attendant: 720, lab: 15 };
const ATTENDANT_DURATION = { attendant_24h: 1440 };

/** Lists every item of the role at the provider's fees, serves the city and sets weekly hours. */
export async function goLive(session, person) {
  for (const item of itemsFor(person.role)) {
    await as(session, `/v1/provider/listings/${item}`, {
      method: 'PUT',
      body: {
        feePaise: feePaise(item, person.feeFactor),
        durationMinutes: ATTENDANT_DURATION[item] ?? DURATION[person.role],
        active: true,
        careSettings: person.role === 'attendant' ? ['home', 'hospital'] : [],
        homeCollection: true,
      },
    });
  }
  await as(session, '/v1/provider/service-area', {
    method: 'PUT',
    body: { pins: cityPins(person.city), travelSurchargePaise: travelFor(person) },
  });
  await as(session, '/v1/provider/availability', {
    method: 'PUT',
    body: { rules: weeklyHours(person.role), bufferMinutes: 15 },
  });
  const { items } = await as(session, '/v1/provider/listings');
  return Object.fromEntries(items.filter((i) => i.listing).map((i) => [i.code, i.listing.id]));
}

const travelFor = (person) =>
  person.role === 'lab' ? 5_000 : 5_000 + (person.mobile.at(-1) % 3) * 2_500;

/** Monday to Saturday 07:00 to 20:00; attendants and labs every day, attendants round the clock. */
function weeklyHours(role) {
  const days = role === 'attendant' || role === 'lab' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const [startMinute, endMinute] = role === 'attendant' ? [0, 1440] : [7 * 60, 20 * 60];
  return days.map((weekday) => ({ weekday, startMinute, endMinute }));
}
