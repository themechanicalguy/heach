'use client';

import { Button, Card, Notice } from '@heach/ui';
import type { Application, IdentityRedirect } from '@heach/types';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

/** Leaves for the identity partner's consent page; the Aadhaar number is never typed here (KY-05). */
export function IdentityStep({ application }: Readonly<{ application: Application }>) {
  const { locale, t } = useI18n();
  const { pending, error, run } = usePending();
  const start = () =>
    run(async () => {
      const { redirectUrl } = await api<IdentityRedirect>('/provider/application/identity/start', {
        method: 'POST',
        body: JSON.stringify({ locale }),
      });
      window.location.assign(redirectUrl);
    });
  const verified = application.identity === 'verified';
  return (
    <Card title={t('application.steps.identity')}>
      <Notice tone={verified ? 'success' : 'info'}>
        {t(`application.identityState.${application.identity}`)}
      </Notice>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {application.editable && !verified && (
        <Button onClick={() => void start()} disabled={pending}>
          {t('application.verifyIdentity')}
        </Button>
      )}
    </Card>
  );
}
