import { createTranslator, messagesFor, type Locale } from '@heach/i18n';
import { Button, CheckboxField, ChoiceGroup, Notice } from '@heach/ui';
import type { AssistedSession } from '@heach/types';
import { useMemo, useState } from 'react';
import { api } from '../api';
import { uploadInit } from '../files';
import { t } from '../i18n';
import { assistedPath, useAssistedCall, type StepProps } from '../use-assisted-call';
import { ErrorNotice, FileField } from './AssistedParts';
import { label } from './labels';

// Never an Aadhaar card: its copy would carry the full number (PR-03).
const KINDS = ['voter_id', 'passport', 'driving_licence', 'pan_card'] as const;
const LOCALE_CHOICES: Locale[] = ['or', 'en', 'hi'];

/** The identity consent wording from the shared catalogue, in the language it is read in. */
function ConsentText({ locale }: Readonly<{ locale: Locale }>) {
  const read = useMemo(() => createTranslator(messagesFor(locale), locale), [locale]);
  return (
    <blockquote lang={locale}>
      <strong>{read('application.identityConsent.title')}</strong>
      <p>{read('application.identityConsent.text')}</p>
    </blockquote>
  );
}

/**
 * Step 4: the fallback identity document (KY-07). Aadhaar and DigiLocker are not offered in
 * assisted mode. The admin reads the consent out and confirms it before anything can be uploaded.
 */
export function AssistedIdentity({ session, application, onSession }: Readonly<StepProps>) {
  const [locale, setLocale] = useState<Locale | ''>('');
  const [read, setRead] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('voter_id');
  const [file, setFile] = useState<File | undefined>();
  const [version, setVersion] = useState(0);
  const { pending, error, call } = useAssistedCall(onSession);
  const upload = () =>
    call(async () => {
      if (!file || locale === '') throw new Error('not ready');
      const extra = {
        kind,
        locale,
        consentVersion: application.identityConsentVersion,
        consentReadAloud: true,
      };
      const next = await api<AssistedSession>(
        assistedPath(session, '/identity-document'),
        await uploadInit(file, extra),
      );
      setFile(undefined);
      setRead(false);
      setVersion((current) => current + 1);
      return next;
    });
  return (
    <section className="admin-form" aria-label={t('assisted.steps.identity')}>
      <h2>{t('assisted.steps.identity')}</h2>
      <p>{t('assisted.identity.intro')}</p>
      <ChoiceGroup
        legend={t('assisted.identity.language')}
        name="assisted-identity-locale"
        value={locale}
        choices={LOCALE_CHOICES.map((value) => ({ value, label: t(`assisted.locales.${value}`) }))}
        onChange={(value) => {
          setLocale(value as Locale);
        }}
      />
      {locale !== '' && <ConsentText locale={locale} />}
      <CheckboxField
        label={t('assisted.identity.readAloud')}
        checked={read}
        disabled={locale === ''}
        onChange={(event) => {
          setRead(event.currentTarget.checked);
        }}
      />
      <Notice tone="warning">{t('assisted.identity.noAadhaar')}</Notice>
      <ChoiceGroup
        legend={t('assisted.identity.kind')}
        name="assisted-identity-kind"
        value={kind}
        choices={KINDS.map((value) => ({ value, label: t(`assisted.identity.kinds.${value}`) }))}
        onChange={(value) => {
          setKind(value as (typeof KINDS)[number]);
        }}
      />
      <FileField
        label={t('assisted.identity.file')}
        accept="application/pdf,image/jpeg,image/png"
        version={version}
        onFile={setFile}
      />
      {application.identity !== 'not_started' && (
        <p>{label('verification.identityStates', application.identity)}</p>
      )}
      <ErrorNotice error={error} />
      <Button onClick={() => void upload()} disabled={!file || !read || locale === '' || pending}>
        {t('assisted.identity.upload')}
      </Button>
    </section>
  );
}
