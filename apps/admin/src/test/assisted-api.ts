import type { AssistedApplication, AssistedSession } from '@heach/types';
import { fakeAdminApi, json } from './fake-api';

export const SESSION_ID = '00000000-0000-4000-8000-0000000000cc';
const BASE = `/assisted-onboarding/sessions/${SESSION_ID}`;

/** A provider application as the assisting admin sees it: states only, never a stored value. */
export function application(overrides: Partial<AssistedApplication> = {}): AssistedApplication {
  return {
    role: 'nurse',
    status: 'draft',
    statusReason: null,
    identity: 'not_started',
    identityConsentVersion: '2026-11-draft.1',
    profile: { qualifications: null, experienceYears: null, hasPhoto: false, photoVerified: false },
    needsPayout: true,
    payoutOnFile: false,
    items: [
      {
        key: 'nursing_registration',
        required: true,
        reference: true,
        expiry: true,
        document: null,
      },
    ],
    missing: ['nursing_registration', 'payout'],
    editable: true,
    ...overrides,
  };
}

export function session(overrides: Partial<AssistedSession> = {}): AssistedSession {
  return {
    sessionId: SESSION_ID,
    mobile: '••••••4321',
    maskedName: 'S•••••• N•••••',
    expiresAt: '2026-11-13T10:00:00.000Z',
    ended: false,
    accountCreated: false,
    setupComplete: true,
    basicDetailsLocked: false,
    payoutCodeSent: false,
    application: application(),
    ...overrides,
  };
}

/**
 * The admin API plus the assisted-onboarding routes. `state.session` is what the server holds;
 * a route changes it through `answer`, which sends the new view.
 */
export function serveAssisted(initial: AssistedSession | null, role = 'support') {
  const state: { session: AssistedSession | null } = { session: initial };
  const answer = (change: Partial<AssistedSession>) => {
    state.session = session({ ...state.session, ...change });
    return json(200, state.session);
  };
  const api = fakeAdminApi({
    role,
    routes: {
      'GET /assisted-onboarding/sessions/current': () =>
        state.session ? json(200, state.session) : json(404, {}),
      'POST /assisted-onboarding/consent': () =>
        api.state.reverified
          ? json(200, {
              sessionId: SESSION_ID,
              mobile: '••••••4321',
              expiresInSeconds: 300,
              resendInSeconds: 30,
            })
          : json(403, { code: 'reverification_required' }),
      [`POST ${BASE}/consent/verify`]: (body) =>
        body.code === '123456'
          ? answer({ application: null })
          : json(401, { code: 'otp_incorrect' }),
      [`POST ${BASE}/end`]: () => {
        state.session = null;
        return json(204);
      },
      [`PUT ${BASE}/details`]: () => answer({ application: application() }),
      [`PUT ${BASE}/documents/nursing_registration`]: () =>
        state.session ? answer({}) : json(409, { code: 'assisted_session_ended' }),
      [`PUT ${BASE}/identity-document`]: () =>
        answer({ application: application({ identity: 'in_review' }) }),
      [`POST ${BASE}/payout/code`]: () =>
        json(200, { mobile: '••••••4321', expiresInSeconds: 300, resendInSeconds: 30 }),
      [`PUT ${BASE}/payout`]: () =>
        api.state.reverified
          ? answer({ application: application({ payoutOnFile: true }) })
          : json(403, { code: 'reverification_required' }),
      [`POST ${BASE}/submit`]: () => {
        state.session = null;
        return json(200, session({ ended: true }));
      },
    },
  });
  return { ...api, session: state };
}
