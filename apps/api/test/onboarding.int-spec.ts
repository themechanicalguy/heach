import { EICAR_MARKER, type FakeSmsSender } from '../src/adapters/fakes.js';
import { SMS_SENDER } from '../src/adapters/sms.port.js';
import { adminSignIn, reverify, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import {
  accountIdOf,
  submittedProvider,
  uploadDocument,
  verifyIdentity,
} from './provider-helpers.js';

interface Application {
  status: string;
  identity: string;
  missing: string[];
  editable: boolean;
  items: { key: string; document: { id: string; scanStatus: string } | null }[];
}

describe('Provider onboarding and verification (J1, J5; PO-01 to PO-06, KY, AD-02)', () => {
  const { app, server } = useApp();
  const application = async (login: Parameters<typeof bearer>[0]) =>
    (await server().get('/v1/provider/application').set(bearer(login)).expect(200))
      .body as Application;

  it('PO-01 a nurse sees the role checklist; submit is refused until it is complete', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    const first = await application(login);
    expect(first).toMatchObject({ status: 'draft', identity: 'not_started', editable: true });
    expect(first.items.map((item) => item.key)).toEqual([
      'nursing_registration',
      'qualification_certificate',
      'police_verification',
    ]);
    expect(first.missing).toEqual([
      'identity',
      'nursing_registration',
      'qualification_certificate',
      'police_verification',
      'payout',
    ]);
    const refused = await server()
      .post('/v1/provider/application/submit')
      .set(bearer(login))
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'application_incomplete' });
  });

  it('PO-02 documents need their number and expiry; unknown items and bad files are refused', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    expect(
      (await uploadDocument(app(), login, 'nursing_registration').expect(400)).body,
    ).toMatchObject({
      code: 'reference_required',
    });
    await uploadDocument(app(), login, 'nursing_registration', { reference: 'SYN-1' }).expect(400);
    await uploadDocument(app(), login, 'unknown_item').expect(404);
    const html = Buffer.from('<html>').toString('base64');
    expect(
      (
        await uploadDocument(app(), login, 'qualification_certificate', {
          contentBase64: html,
        }).expect(422)
      ).body,
    ).toMatchObject({
      code: 'upload_mismatch',
    });
  });

  it('EN-07 an infected file is quarantined and never stored as content', async () => {
    const { login } = await signedUp(app(), { role: 'attendant', languages: ['or'] });
    const infected = Buffer.from(`%PDF-1.7 ${EICAR_MARKER}`).toString('base64');
    await uploadDocument(app(), login, 'address_proof', { contentBase64: infected }).expect(400);
    const view = await application(login);
    expect(view.items.find((item) => item.key === 'address_proof')?.document?.scanStatus).toBe(
      'infected',
    );
    expect(view.missing).toContain('address_proof');
  });
});

describe('Provider identity and payout details (KY-05, PO-06)', () => {
  const { app, db, server } = useApp();
  const application = async (login: Parameters<typeof bearer>[0]) =>
    (await server().get('/v1/provider/application').set(bearer(login)).expect(200))
      .body as Application;

  it('KY-05 identity is checked through the partner; no Aadhaar number is stored', async () => {
    const { login } = await signedUp(app(), { role: 'physiotherapist', languages: ['en'] });
    await verifyIdentity(app(), login);
    expect((await application(login)).identity).toBe('verified');
    const columns = await db().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'identity_check'`,
    );
    expect(columns.rows.map((row) => row.column_name).join(',')).not.toMatch(/aadhaar|number|uid/);
    await server()
      .post('/v1/provider/application/identity/complete')
      .set(bearer(login))
      .send({ code: 'approved', reference: 'not-the-pending-one' })
      .expect(409);
  });

  it('PO-06 payout details need a fresh OTP and are stored encrypted', async () => {
    const { mobile, login } = await signedUp(app(), {
      role: 'lab',
      organisationName: 'Synthetic Lab',
      languages: ['en'],
    });
    const payout = {
      method: 'bank',
      holderName: 'Synthetic Lab',
      accountNumber: '123456789012',
      ifsc: 'SYNT0001234',
    };
    const refused = await server()
      .put('/v1/provider/application/payout')
      .set(bearer(login))
      .send(payout)
      .expect(403);
    expect(refused.body).toMatchObject({ code: 'reverification_required' });
    await reverify(app(), mobile, login);
    const saved = await server()
      .put('/v1/provider/application/payout')
      .set(bearer(login))
      .send(payout)
      .expect(200);
    expect(saved.body).toMatchObject({ payout: { method: 'bank', hint: '9012' } });
    const stored = await db().query<{ destination: string }>(
      'SELECT destination::text FROM app.payout_account WHERE account_id = $1',
      [await accountIdOf(app(), login)],
    );
    expect(stored.rows[0]?.destination).not.toContain('123456789012');
  });
});

describe('Provider verification by an admin (J5; AD-02, NT-01)', () => {
  const { app, server } = useApp();
  const application = async (login: Parameters<typeof bearer>[0]) =>
    (await server().get('/v1/provider/application').set(bearer(login)).expect(200))
      .body as Application;

  it('J5 a verifier reviews, requests changes, then approves; the provider is told by SMS', async () => {
    const provider = await submittedProvider(app(), 'nurse');
    expect((await application(provider.login)).editable).toBe(false);
    const verifier = await adminSignIn(app(), 'verifier');
    const queue = await server().get('/admin/v1/applications').set(bearer(verifier)).expect(200);
    expect(
      (queue.body as { accountId: string }[]).some((row) => row.accountId === provider.accountId),
    ).toBe(true);

    const review = await server()
      .get(`/admin/v1/applications/${provider.accountId}`)
      .set(bearer(verifier))
      .expect(200);
    const body = review.body as Application & { history: { toStatus: string }[] };
    expect(body.status).toBe('under_review');
    const documentId = body.items[0]?.document?.id ?? '';
    const file = await server()
      .get(`/admin/v1/applications/${provider.accountId}/documents/${documentId}`)
      .set(bearer(verifier))
      .expect(200);
    expect(file.body).toMatchObject({ contentType: 'application/pdf' });
    await server()
      .post(`/admin/v1/applications/${provider.accountId}/documents`)
      .set(bearer(verifier))
      .send({ documentId, status: 'rejected', reason: 'documents_unclear' })
      .expect(204);
    await server()
      .post(`/admin/v1/applications/${provider.accountId}/decision`)
      .set(bearer(verifier))
      .send({ decision: 'request_changes', reason: 'documents_unclear' })
      .expect(204);

    const back = await application(provider.login);
    expect(back).toMatchObject({ status: 'changes_requested', editable: true });
    expect(back.missing).toEqual(['nursing_registration']);
    await uploadDocument(app(), provider.login, 'nursing_registration', {
      reference: 'SYN-2',
      expiresOn: '2031-01-01',
    }).expect(200);
    await server().post('/v1/provider/application/submit').set(bearer(provider.login)).expect(200);
    await server()
      .get(`/admin/v1/applications/${provider.accountId}`)
      .set(bearer(verifier))
      .expect(200);
    await server()
      .post(`/admin/v1/applications/${provider.accountId}/decision`)
      .set(bearer(verifier))
      .send({ decision: 'approve' })
      .expect(204);
    expect((await application(provider.login)).status).toBe('approved');
    const sms = app()
      .get<FakeSmsSender>(SMS_SENDER)
      .sent.filter((message) => message.to === provider.mobile);
    expect(sms.map((message) => message.templateId)).toEqual(
      expect.arrayContaining(['application_changes_requested', 'application_approved']),
    );
    await server()
      .post(`/admin/v1/applications/${provider.accountId}/decision`)
      .set(bearer(verifier))
      .send({ decision: 'reject', reason: 'other' })
      .expect(409);
  });

  it('SE-02 only verifiers and super admins see the queue; patients never see applications', async () => {
    const support = await adminSignIn(app(), 'support');
    await server().get('/admin/v1/applications').set(bearer(support)).expect(403);
    const { login } = await signedUp(app());
    await server().get('/v1/provider/application').set(bearer(login)).expect(403);
    const verifier = await adminSignIn(app(), 'verifier');
    await server()
      .post(`/admin/v1/applications/${await accountIdOf(app(), login)}/decision`)
      .set(bearer(verifier))
      .send({ decision: 'approve' })
      .expect(404);
  });
});
