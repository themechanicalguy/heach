import { EICAR_MARKER, type FakeIdentityVerifier } from '../src/adapters/fakes.js';
import { IDENTITY_VERIFIER, type SharedDocument } from '../src/adapters/identity.port.js';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import {
  submittedProvider,
  SYNTHETIC_PDF,
  uploadDocument,
  verifyIdentity,
} from './provider-helpers.js';

const pdf = { contentType: 'application/pdf', contentBase64: SYNTHETIC_PDF };
const DEGREE: SharedDocument = {
  type: 'degree_certificate',
  issuer: 'Synthetic University',
  ...pdf,
};
const REGISTRATION: SharedDocument = {
  type: 'registration_certificate',
  issuer: 'Synthetic Nursing Council',
  reference: 'SYN-REG-9',
  expiresOn: '2031-01-01',
  ...pdf,
};
interface Item {
  key: string;
  document: {
    source: string;
    issuer: string | null;
    reference: string | null;
    reviewStatus: string;
  } | null;
}

describe('Documents shared from DigiLocker are stored as verified copies (KY-02)', () => {
  const { app, server } = useApp();
  const partner = () => app().get<FakeIdentityVerifier>(IDENTITY_VERIFIER);
  const items = async (login: Parameters<typeof bearer>[0]) =>
    (
      (await server().get('/v1/provider/application').set(bearer(login)).expect(200)).body as {
        items: Item[];
      }
    ).items;
  const item = async (login: Parameters<typeof bearer>[0], key: string) =>
    (await items(login)).find((entry) => entry.key === key)?.document;
  const sharing = async (login: Parameters<typeof bearer>[0], documents: SharedDocument[]) => {
    partner().documents = documents;
    try {
      await verifyIdentity(app(), login);
    } finally {
      partner().documents = undefined;
    }
  };

  it('KY-02 shared documents fill the checklist as issued copies; unneeded ones are dropped', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    await uploadDocument(app(), login, 'qualification_certificate').expect(200);
    const pan: SharedDocument = { type: 'pan_card', issuer: 'Synthetic Tax Office', ...pdf };
    await sharing(login, [DEGREE, REGISTRATION, pan]);
    expect(await item(login, 'qualification_certificate')).toMatchObject({
      source: 'digilocker',
      issuer: 'Synthetic University',
    });
    expect(await item(login, 'nursing_registration')).toMatchObject({
      source: 'digilocker',
      issuer: 'Synthetic Nursing Council',
      reference: 'SYN-REG-9',
    });
    expect((await items(login)).filter((entry) => entry.document)).toHaveLength(2);
    // A later upload by the provider is an upload again.
    await uploadDocument(app(), login, 'qualification_certificate').expect(200);
    expect(await item(login, 'qualification_certificate')).toMatchObject({
      source: 'upload',
      issuer: null,
    });
  });

  it('KY-02 a bad or incomplete shared document is skipped without failing the check', async () => {
    const { login } = await signedUp(app(), { role: 'nurse', languages: ['or'] });
    const html = { ...DEGREE, contentBase64: Buffer.from('<html>').toString('base64') };
    const infected = {
      ...DEGREE,
      contentBase64: Buffer.from(`%PDF-1.7 ${EICAR_MARKER}`).toString('base64'),
    };
    const unnumbered: SharedDocument = {
      type: 'registration_certificate',
      issuer: 'Synthetic Nursing Council',
      expiresOn: '2031-01-01',
      ...pdf,
    };
    await sharing(login, [html, infected, unnumbered]);
    expect((await items(login)).filter((entry) => entry.document)).toHaveLength(0);
    const view = await server().get('/v1/provider/application').set(bearer(login)).expect(200);
    expect(view.body).toMatchObject({ identity: 'verified' });
  });

  it('KY-02 the verifier sees the issuer; an accepted document is not replaced by a share', async () => {
    const provider = await submittedProvider(app(), 'nurse');
    const verifier = await adminSignIn(app(), 'verifier');
    const path = `/admin/v1/applications/${provider.accountId}`;
    const review = await server().get(path).set(bearer(verifier)).expect(200);
    const documents = (review.body as { items: { key: string; document: { id: string } }[] }).items;
    const documentId = documents.find((entry) => entry.key === 'qualification_certificate')
      ?.document.id;
    await server()
      .post(`${path}/documents`)
      .set(bearer(verifier))
      .send({ documentId, status: 'accepted' })
      .expect(204);
    await server()
      .post(`${path}/decision`)
      .set(bearer(verifier))
      .send({ decision: 'request_changes', reason: 'documents_unclear' })
      .expect(204);
    await sharing(provider.login, [DEGREE, REGISTRATION]);
    expect(await item(provider.login, 'qualification_certificate')).toMatchObject({
      source: 'upload',
      reviewStatus: 'accepted',
    });
    await server().post('/v1/provider/application/submit').set(bearer(provider.login)).expect(200);
    const again = await server().get(path).set(bearer(verifier)).expect(200);
    const shared = (again.body as { items: Item[] }).items.find(
      (entry) => entry.key === 'nursing_registration',
    );
    expect(shared?.document).toMatchObject({
      source: 'digilocker',
      issuer: 'Synthetic Nursing Council',
      reviewStatus: 'pending',
    });
  });
});
