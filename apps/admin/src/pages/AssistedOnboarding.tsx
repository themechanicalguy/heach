import { Button, ErrorState, Notice, Progress, Skeleton } from '@heach/ui';
import type { AssistedApplication, AssistedSession } from '@heach/types';
import { useState } from 'react';
import { ApiError, api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import type { SessionHandler } from '../use-assisted-call';
import { AssistedConsent } from './AssistedConsent';
import { AssistedDetails } from './AssistedDetails';
import { AssistedDocuments } from './AssistedDocuments';
import { AssistedIdentity } from './AssistedIdentity';
import { AssistedPayout } from './AssistedPayout';
import { AssistedProfile } from './AssistedProfile';
import { AssistedReview } from './AssistedReview';
import { AssistedSessionBar } from './AssistedSessionBar';

type StepKey = 'documents' | 'identity' | 'profile' | 'payout' | 'review';

const STEPS: Record<StepKey, typeof AssistedDocuments> = {
  documents: AssistedDocuments,
  identity: AssistedIdentity,
  profile: AssistedProfile,
  payout: AssistedPayout,
  review: AssistedReview,
};

function stepsFor(application: AssistedApplication): StepKey[] {
  const steps: StepKey[] = ['documents', 'identity', 'profile'];
  if (application.needsPayout) steps.push('payout');
  return [...steps, 'review'];
}

interface WorkProps {
  session: AssistedSession;
  application: AssistedApplication;
  onSession: SessionHandler;
}

/** The steps after the basic details, one at a time, with progress. */
function Steps({ session, application, onSession }: Readonly<WorkProps>) {
  const [chosen, setChosen] = useState<StepKey>('documents');
  const steps = stepsFor(application);
  const current = steps.includes(chosen) ? chosen : 'documents';
  const Step = STEPS[current];
  return (
    <>
      <Progress
        current={steps.indexOf(current) + 1}
        total={steps.length}
        label={t('assisted.stepOf', { current: steps.indexOf(current) + 1, total: steps.length })}
      />
      <nav aria-label={t('assisted.stepsLabel')}>
        <ul className="admin-actions">
          {steps.map((step) => (
            <li key={step}>
              <Button
                className="heach-button--secondary"
                aria-current={step === current ? 'step' : undefined}
                onClick={() => {
                  setChosen(step);
                }}
              >
                {t(`assisted.steps.${step}`)}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <Step session={session} application={application} onSession={onSession} />
    </>
  );
}

/** The running session's current step, from what the server says is done (no session state here). */
function Running({ session, onSession }: Readonly<Omit<WorkProps, 'application'>>) {
  return (
    <>
      <AssistedSessionBar session={session} onSession={onSession} />
      {session.application ? (
        <Steps session={session} application={session.application} onSession={onSession} />
      ) : (
        <AssistedDetails session={session} onSession={onSession} />
      )}
    </>
  );
}

async function loadCurrent(): Promise<AssistedSession | null> {
  try {
    return await api<AssistedSession>('/assisted-onboarding/sessions/current');
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null;
    throw caught;
  }
}

type Outcome = 'ended' | 'submitted' | undefined;

/** Assisted onboarding (AD-12): a support admin sets up a provider's profile with their consent. */
export function AssistedOnboarding() {
  const { loaded, reload } = useLoad(loadCurrent);
  const [changed, setChanged] = useState<{ session: AssistedSession | null } | undefined>();
  const [outcome, setOutcome] = useState<Outcome>();
  const onSession: SessionHandler = (next) => {
    if (next?.ended) {
      setOutcome('submitted');
      setChanged({ session: null });
      return;
    }
    setOutcome(next ? undefined : 'ended');
    setChanged({ session: next });
  };
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (loaded.state === 'error') {
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  }
  const session = changed ? changed.session : loaded.value;
  return (
    <>
      <h1>{t('assisted.title')}</h1>
      <p>{t('assisted.intro')}</p>
      {outcome === 'ended' && (
        <Notice tone="info" live>
          {t('assisted.ended')}
        </Notice>
      )}
      {outcome === 'submitted' && (
        <Notice tone="success" live>
          {t('assisted.review.submitted')}
        </Notice>
      )}
      {session ? (
        <Running session={session} onSession={onSession} />
      ) : (
        <AssistedConsent onSession={onSession} />
      )}
    </>
  );
}
