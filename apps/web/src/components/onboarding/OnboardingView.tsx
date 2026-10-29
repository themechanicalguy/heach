'use client';

import { Button, Notice } from '@heach/ui';
import type { Application } from '@heach/types';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { DocumentItem } from './DocumentItem';
import { IdentityStep } from './IdentityStep';
import { PayoutForm } from './PayoutForm';

const TONE: Record<Application['status'], 'info' | 'warning' | 'danger' | 'success'> = {
  draft: 'info',
  submitted: 'info',
  under_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

/** The provider's checklist hub (J1, PO-01 to PO-06): identity, documents, payout, submit. */
export function OnboardingView() {
  const { resource, reload } = useResource<Application>('/provider/application');
  return (
    <ResourceView resource={resource} reload={reload}>
      {(application) => <Hub initial={application} />}
    </ResourceView>
  );
}

function Hub({ initial }: Readonly<{ initial: Application }>) {
  const { t } = useI18n();
  const [application, setApplication] = useState(initial);
  const { pending, error, run } = usePending();
  useEffect(() => {
    setApplication(initial);
  }, [initial]);
  const submit = () =>
    run(async () => {
      setApplication(await api<Application>('/provider/application/submit', { method: 'POST' }));
    });

  return (
    <section className="flow" aria-labelledby="application-title">
      <div className="flow__card">
        <h1 id="application-title" className="flow__title">
          {t('application.title')}
        </h1>
        <p className="flow__muted">
          {t(keyFor('roles', application.role, 'application.title', '.label'))}
        </p>
        <p className="status-card__line">
          <span>{t('application.statusLabel')}</span>
          <strong>{t(`application.status.${application.status}`)}</strong>
        </p>
        <Notice tone={TONE[application.status]} live>
          {t(`application.statusText.${application.status}`)}
        </Notice>
        <IdentityStep application={application} />
        <h2 className="flow__subtitle">{t('application.steps.documents')}</h2>
        <ul className="role-list">
          {application.items.map((entry) => (
            <li key={entry.key}>
              <DocumentItem
                entry={entry}
                editable={application.editable}
                onSaved={setApplication}
              />
            </li>
          ))}
        </ul>
        {application.needsPayout && (
          <PayoutForm application={application} onSaved={setApplication} />
        )}
        {application.editable && (
          <Submit application={application} pending={pending} onSubmit={submit} />
        )}
        {error && (
          <Notice tone="danger" live>
            {t(error)}
          </Notice>
        )}
      </div>
    </section>
  );
}

interface SubmitProps {
  application: Application;
  pending: boolean;
  onSubmit: () => Promise<void>;
}

function Submit({ application, pending, onSubmit }: Readonly<SubmitProps>) {
  const { t } = useI18n();
  const missingLabel = (key: string) =>
    key === 'identity' || key === 'payout'
      ? t(`application.missing.${key}`)
      : t(keyFor('application.items', key, 'application.steps.documents'));
  return (
    <>
      {application.missing.length > 0 && (
        <>
          <h2 className="flow__subtitle">{t('application.missingTitle')}</h2>
          <ul>
            {application.missing.map((key) => (
              <li key={key}>{missingLabel(key)}</li>
            ))}
          </ul>
        </>
      )}
      <Button onClick={() => void onSubmit()} disabled={pending || application.missing.length > 0}>
        {t('application.submit')}
      </Button>
      <p className="flow__muted">{t('application.reviewTime')}</p>
    </>
  );
}
