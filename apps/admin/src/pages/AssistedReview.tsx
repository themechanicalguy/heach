import { Button, Notice } from '@heach/ui';
import type { AssistedSession } from '@heach/types';
import { api } from '../api';
import { t } from '../i18n';
import { assistedPath, useAssistedCall, type StepProps } from '../use-assisted-call';
import { ErrorNotice } from './AssistedParts';
import { label } from './labels';

/** The last step: what is still missing, and the submit that ends the session (AD-12). */
export function AssistedReview({ session, application, onSession }: Readonly<StepProps>) {
  const { pending, error, call } = useAssistedCall(onSession);
  const submit = () =>
    call(() => api<AssistedSession>(assistedPath(session, '/submit'), { method: 'POST' }));
  const blocked = application.missing.length > 0 || !application.editable;
  return (
    <section aria-label={t('assisted.steps.review')}>
      <h2>{t('assisted.steps.review')}</h2>
      <dl className="admin-facts">
        <dt>{t('assisted.review.status')}</dt>
        <dd>{label('verification.statuses', application.status)}</dd>
        <dt>{t('verification.identity')}</dt>
        <dd>{label('verification.identityStates', application.identity)}</dd>
        {application.needsPayout && (
          <>
            <dt>{t('verification.payout')}</dt>
            <dd>
              {application.payoutOnFile
                ? t('assisted.payout.onFile')
                : t('verification.payoutNone')}
            </dd>
          </>
        )}
      </dl>
      {application.missing.length > 0 ? (
        <Notice tone="warning">{`${t('assisted.review.missing')}: ${application.missing.join(', ')}`}</Notice>
      ) : (
        <Notice tone="success">{t('assisted.review.ready')}</Notice>
      )}
      <ErrorNotice error={error} />
      <Button onClick={() => void submit()} disabled={blocked || pending}>
        {t('assisted.review.submit')}
      </Button>
    </section>
  );
}
