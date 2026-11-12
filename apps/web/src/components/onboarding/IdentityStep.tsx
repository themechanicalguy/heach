'use client';

import { Button, Card, CheckboxField, Notice } from '@heach/ui';
import type { Application, IdentityRedirect } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { IdentityFallback } from './IdentityFallback';
import { VerifiedDetails } from './VerifiedDetails';

interface Props {
  application: Application;
  onSaved: (application: Application) => void;
}

/**
 * Consent first (KY-01), then the identity partner's page or, as a fallback, another identity
 * document (KY-07). The Aadhaar number is never typed here (KY-05).
 */
export function IdentityStep({ application, onSaved }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const [consented, setConsented] = useState(false);
  const { pending, error, run } = usePending();
  const start = () =>
    run(async () => {
      const body = { locale, consentVersion: application.identityConsentVersion };
      const { redirectUrl } = await api<IdentityRedirect>('/provider/application/identity/start', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      window.location.assign(redirectUrl);
    });
  const verified = application.identity === 'verified';
  const kind = application.identityDocumentKind;
  return (
    <Card title={t('application.steps.identity')}>
      <Notice tone={verified ? 'success' : 'info'}>
        {t(`application.identityState.${application.identity}`)}
      </Notice>
      {kind && (
        <p className="flow__muted">
          {t('application.identityFallback.onFile', {
            kind: t(`application.identityFallback.kinds.${kind}`),
          })}
        </p>
      )}
      {application.identityDetailsVerified && <VerifiedDetails />}
      {application.editable && !verified && (
        <>
          <h3>{t('application.identityConsent.title')}</h3>
          <p>{t('application.identityConsent.text')}</p>
          <CheckboxField
            label={t('application.identityConsent.agree')}
            checked={consented}
            onChange={(event) => {
              setConsented(event.currentTarget.checked);
            }}
          />
          {error && (
            <Notice tone="danger" live>
              {t(error)}
            </Notice>
          )}
          <Button onClick={() => void start()} disabled={!consented || pending}>
            {t('application.verifyIdentity')}
          </Button>
          <IdentityFallback application={application} consented={consented} onSaved={onSaved} />
        </>
      )}
    </Card>
  );
}
