import { adminSignIn, otpSignIn, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { completeAssisted } from './assisted-helpers.js';
import { submittedProvider } from './provider-helpers.js';

const APPLICATIONS = '/admin/v1/applications';

interface Summary {
  accountId: string;
  assisted: boolean;
  assistedByYou: boolean;
}

interface Review {
  assisted: boolean;
  identityConsentAssisted: boolean;
  providerConsentDue: boolean;
  items: { document: { id: string } | null }[];
}

/** Calls bound to one block's app: an assisted application and the admins around it. */
function reviewCalls(context: ReturnType<typeof useApp>) {
  const { app, db, server } = context;
  const assistedApplication = async () => {
    const assister = await adminSignIn(app(), 'super_admin');
    const journey = await completeAssisted(app(), assister, 'nurse');
    return { assister, ...journey };
  };
  const review = async (admin: Parameters<typeof bearer>[0], accountId: string) =>
    (await server().get(`${APPLICATIONS}/${accountId}`).set(bearer(admin)).expect(200))
      .body as Review;
  const queueOf = async (admin: Parameters<typeof bearer>[0]) =>
    (await server().get(APPLICATIONS).set(bearer(admin)).expect(200)).body as Summary[];
  const refusals = async (accountId: string) =>
    (
      await db().query<{ actor_id: string }>(
        `SELECT actor_id FROM audit.entry
          WHERE action = 'provider_application.review.refused_assisted' AND entity_id = $1`,
        [accountId],
      )
    ).rows;
  return { app, server, assistedApplication, review, queueOf, refusals };
}

describe('AD-12 the admin who assisted cannot review', () => {
  const context = useApp();
  const { app, server, assistedApplication, review, refusals } = reviewCalls(context);

  it('AD-12 the assisting super admin is refused everywhere, the refusal is audited, another verifier can work', async () => {
    const { assister, accountId } = await assistedApplication();
    const verifier = await adminSignIn(app(), 'verifier');
    const opened = await review(verifier, accountId);
    const documentId = opened.items.find((item) => item.document)?.document?.id ?? '';
    const url = `${APPLICATIONS}/${accountId}`;
    const as = bearer(assister);
    const decision = (body: object) => () => server().post(`${url}/decision`).set(as).send(body);
    const refused = [
      () => server().get(url).set(as),
      () => server().get(`${url}/documents/${documentId}`).set(as),
      () => server().get(`${url}/photo`).set(as),
      () => server().get(`${url}/identity-document`).set(as),
      () => server().post(`${url}/documents`).set(as).send({ documentId, status: 'accepted' }),
      () => server().post(`${url}/identity`).set(as).send({ status: 'accepted' }),
      decision({ decision: 'approve' }),
      decision({ decision: 'reject', reason: 'documents_unclear' }),
      decision({ decision: 'request_changes', reason: 'documents_unclear' }),
    ];
    for (const call of refused) {
      const response = await call();
      expect([response.status, response.body]).toEqual([
        403,
        expect.objectContaining({ code: 'assisted_by_you' }),
      ]);
    }
    expect(await refusals(accountId)).toHaveLength(refused.length);
    expect((await refusals(accountId))[0]).toEqual({ actor_id: assister.id });
    for (const path of [`documents/${documentId}`, 'photo', 'identity-document']) {
      await server().get(`${url}/${path}`).set(bearer(verifier)).expect(200);
    }
    await server()
      .post(`${url}/documents`)
      .set(bearer(verifier))
      .send({ documentId, status: 'accepted' })
      .expect(204);
  });
});

describe('AD-12 the queue and the review show assisted work', () => {
  const context = useApp();
  const { app, assistedApplication, review, queueOf } = reviewCalls(context);

  it('AD-12 the queue marks assisted applications, and assistedByYou only for the assisting admin', async () => {
    const { assister, accountId } = await assistedApplication();
    const own = await submittedProvider(app(), 'nurse');
    const verifier = await adminSignIn(app(), 'verifier');
    const find = (queue: Summary[], id: string) => queue.find((entry) => entry.accountId === id);
    const forAssister = await queueOf(assister);
    const forVerifier = await queueOf(verifier);
    expect(find(forAssister, accountId)).toMatchObject({ assisted: true, assistedByYou: true });
    expect(find(forVerifier, accountId)).toMatchObject({ assisted: true, assistedByYou: false });
    expect(find(forVerifier, own.accountId)).toMatchObject({
      assisted: false,
      assistedByYou: false,
    });
    expect(await review(verifier, own.accountId)).toMatchObject({
      assisted: false,
      identityConsentAssisted: false,
      providerConsentDue: false,
    });
    expect((await review(assister, own.accountId)).assisted).toBe(false);
  });
});

describe('AD-12 approval waits for the provider to accept the terms', () => {
  const context = useApp();
  const { app, server, assistedApplication, review } = reviewCalls(context);

  it('AD-12 approval is 409 provider_consent_due until the provider accepts terms and privacy', async () => {
    const { mobile, accountId } = await assistedApplication();
    const verifier = await adminSignIn(app(), 'verifier');
    const url = `${APPLICATIONS}/${accountId}`;
    expect(await review(verifier, accountId)).toMatchObject({
      assisted: true,
      identityConsentAssisted: true,
      providerConsentDue: true,
    });
    await server().post(`${url}/identity`).set(bearer(verifier)).send({ status: 'accepted' });
    const decide = () => server().post(`${url}/decision`).set(bearer(verifier));
    const early = await decide().send({ decision: 'approve' }).expect(409);
    expect(early.body).toMatchObject({ code: 'provider_consent_due' });

    const { login } = await otpSignIn(app(), mobile);
    const me = await server().get('/v1/me').set(bearer(login)).expect(200);
    expect(me.body).toMatchObject({ consentsDue: [{ purpose: 'terms' }, { purpose: 'privacy' }] });
    await server()
      .post('/v1/me/consents')
      .set(bearer(login))
      .send({ consents: (me.body as { consentsDue: object[] }).consentsDue })
      .expect(204);

    expect((await review(verifier, accountId)).providerConsentDue).toBe(false);
    await decide().send({ decision: 'approve' }).expect(204);
  });
});
