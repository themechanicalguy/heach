import { messagesFor } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import en from '../../messages/en.json';
import { serveAssisted, session } from '../test/assisted-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openStep(step: keyof typeof en.assisted.steps) {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: en.nav.assisted }));
  fireEvent.click(await screen.findByRole('button', { name: en.assisted.steps[step] }));
}

const pdf = () => new File(['%PDF synthetic'], 'synthetic.pdf', { type: 'application/pdf' });

function choose(label: string, file: File) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

describe('Assisted onboarding: documents and identity (AD-12)', () => {
  it('AD-12 a document uploads as the web app sends it, with its number and expiry', async () => {
    const { calls } = serveAssisted(session());
    await openStep('documents');
    choose(en.assisted.documents.file, pdf());
    fireEvent.change(screen.getByLabelText(en.assisted.documents.number), {
      target: { value: 'SYN-1' },
    });
    fireEvent.change(screen.getByLabelText(en.assisted.documents.expires), {
      target: { value: '2030-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.assisted.documents.upload }));
    await waitFor(() => {
      expect(calls.some((call) => call.path.endsWith('/documents/nursing_registration'))).toBe(
        true,
      );
    });
    const call = calls.find((c) => c.path.endsWith('/documents/nursing_registration'));
    expect(call?.contentType).toBe('application/vnd.heach.upload+json');
    expect(call?.body).toEqual({
      contentType: 'application/pdf',
      contentBase64: btoa('%PDF synthetic'),
      reference: 'SYN-1',
      expiresOn: '2030-01-01',
    });
  });

  it('AD-12 an ended session sends the admin back to the start screen', async () => {
    const api = serveAssisted(session());
    await openStep('documents');
    api.session.session = null;
    choose(en.assisted.documents.file, pdf());
    fireEvent.click(screen.getByRole('button', { name: en.assisted.documents.upload }));
    expect(await screen.findByText(en.assisted.ended)).toBeTruthy();
    expect(screen.getByLabelText(en.assisted.mobile)).toBeTruthy();
  });

  it('KY-01 the consent is read in the provider language and must be confirmed before upload', async () => {
    const { calls } = serveAssisted(session());
    await openStep('identity');
    const upload = screen.getByRole('button', { name: en.assisted.identity.upload });
    choose(en.assisted.identity.file, pdf());
    expect(upload).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByLabelText(en.assisted.locales.or));
    const odia = messagesFor('or').application.identityConsent.text;
    expect(screen.getByText(odia).closest('blockquote')?.getAttribute('lang')).toBe('or');
    expect(upload).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByLabelText(en.assisted.identity.readAloud));
    expect(upload).toHaveProperty('disabled', false);
    fireEvent.click(upload);
    await waitFor(() => {
      expect(calls.some((call) => call.path.endsWith('/identity-document'))).toBe(true);
    });
    expect(calls.find((c) => c.path.endsWith('/identity-document'))?.body).toMatchObject({
      kind: 'voter_id',
      locale: 'or',
      consentVersion: '2026-11-draft.1',
      consentReadAloud: true,
    });
  });
});
