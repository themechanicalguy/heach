'use client';

import { Button, Notice, Progress } from '@heach/ui';
import type { Application } from '@heach/types';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { DocumentItem } from './DocumentItem';
import { IdentityStep } from './IdentityStep';
import { PayoutForm } from './PayoutForm';
import { type EditableStep, ReviewStep } from './ReviewStep';
import { rememberSubmitted } from './submitted-notice';

const TONE: Record<Application['status'], 'info' | 'warning' | 'danger' | 'success'> = {
  draft: 'info',
  submitted: 'info',
  under_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

type Step = EditableStep | 'review';

/** The provider's guided application (J1, PO-01 to PO-06): identity, documents, payout, submit. */
export function OnboardingView() {
  const { resource, reload } = useResource<Application>('/provider/application');
  return (
    <ResourceView resource={resource} reload={reload}>
      {(application) => <Hub initial={application} />}
    </ResourceView>
  );
}

function Hub({ initial }: Readonly<{ initial: Application }>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [application, setApplication] = useState(initial);
  const [step, setStep] = useState<Step>(initial.editable ? 'identity' : 'review');
  const heading = useRef<HTMLHeadingElement>(null);
  const steps: Step[] = initial.needsPayout
    ? ['identity', 'documents', 'payout', 'review']
    : ['identity', 'documents', 'review'];
  const { pending, error, run } = usePending();
  useEffect(() => {
    const stepTitle = t(`application.steps.${step}`);
    document.title = `${stepTitle} · ${t('application.title')} · ${t('app.name')}`;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step, t]);
  useEffect(() => {
    setApplication(initial);
  }, [initial]);
  const submit = () =>
    run(async () => {
      setApplication(await api<Application>('/provider/application/submit', { method: 'POST' }));
      rememberSubmitted();
      router.push(`/${locale}`);
    });

  return (
    <section className="flow onboarding-layout" aria-labelledby="application-title">
      <StepNavigation steps={steps} step={step} onSelect={setStep} />
      <div className="flow__card">
        <h1 ref={heading} tabIndex={-1} id="application-title" className="flow__title">
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
        <Progress
          label={t('application.progress', {
            current: steps.indexOf(step) + 1,
            total: steps.length,
            remaining: steps.length - steps.indexOf(step) - 1,
          })}
          current={steps.indexOf(step) + 1}
          total={steps.length}
        />
        {step === 'identity' && <IdentityStep application={application} />}
        {step === 'documents' && <Documents application={application} onSaved={setApplication} />}
        {step === 'payout' && application.needsPayout && (
          <PayoutForm application={application} onSaved={setApplication} />
        )}
        {step === 'review' && (
          <ReviewStep
            application={application}
            pending={pending}
            onEdit={setStep}
            onSubmit={submit}
          />
        )}
        <StepActions steps={steps} step={step} onSelect={setStep} />
        <p>{t('application.progressHint')}</p>
        {error && (
          <Notice tone="danger" live>
            {t(error)}
          </Notice>
        )}
      </div>
    </section>
  );
}

interface StepProps {
  steps: Step[];
  step: Step;
  onSelect: (step: Step) => void;
}
function StepNavigation({ steps, step, onSelect }: Readonly<StepProps>) {
  const { t } = useI18n();
  return (
    <nav className="onboarding-steps" aria-label={t('application.title')}>
      {steps.map((entry, index) => (
        <button
          type="button"
          key={entry}
          className="header-pill"
          aria-current={step === entry ? 'step' : undefined}
          onClick={() => {
            onSelect(entry);
          }}
        >
          {String(index + 1)}.{' '}
          {t(entry === 'review' ? 'application.steps.review' : `application.steps.${entry}`)}
        </button>
      ))}
    </nav>
  );
}
function StepActions({ steps, step, onSelect }: Readonly<StepProps>) {
  const { t } = useI18n();
  const previous = steps[steps.indexOf(step) - 1];
  const next = steps[steps.indexOf(step) + 1];
  return (
    <div className="actions">
      {previous && (
        <Button
          className="heach-button--secondary"
          onClick={() => {
            onSelect(previous);
          }}
        >
          {t('setup.back')}
        </Button>
      )}
      {next && (
        <Button
          onClick={() => {
            onSelect(next);
          }}
        >
          {t('setup.continue')}
        </Button>
      )}
    </div>
  );
}
function Documents({
  application,
  onSaved,
}: Readonly<{ application: Application; onSaved: (value: Application) => void }>) {
  const { t } = useI18n();
  return (
    <>
      <h2 className="flow__subtitle">{t('application.steps.documents')}</h2>
      <ul className="role-list">
        {application.items.map((entry) => (
          <li key={entry.key}>
            <DocumentItem entry={entry} editable={application.editable} onSaved={onSaved} />
          </li>
        ))}
      </ul>
    </>
  );
}
