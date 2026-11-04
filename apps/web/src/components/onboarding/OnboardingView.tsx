'use client';

import { Button, Icon, Notice } from '@heach/ui';
import type { Application } from '@heach/types';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { DocumentItem } from './DocumentItem';
import { IdentityStep } from './IdentityStep';
import { Checklist, StatusCard } from './OnboardingChecklist';
import { PayoutForm } from './PayoutForm';
import { nextTask, type Task, tasksFor } from './tasks';

type View = Task | 'overview';

const TONE: Record<Application['status'], 'info' | 'warning' | 'danger' | 'success'> = {
  draft: 'info',
  submitted: 'info',
  under_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

/** The provider's guided application (J1, PO-01 to PO-06): identity, documents, payout, submit. */
export function OnboardingView() {
  const { resource, reload } = useResource<Application>('/provider/application');
  return (
    <ResourceView resource={resource} reload={reload}>
      {(application) => <Hub initial={application} />}
    </ResourceView>
  );
}

/**
 * Onboarding B (G06): the checklist overview with a purple completion card, then one focused task
 * at a time. From desktop width the checklist stays beside the task as the step rail (board 14).
 */
function Hub({ initial }: Readonly<{ initial: Application }>) {
  const { t } = useI18n();
  const [application, setApplication] = useState(initial);
  const [view, setView] = useState<View>('overview');
  const heading = useRef<HTMLHeadingElement>(null);
  const { pending, error, run } = usePending();
  useEffect(() => {
    const title = view === 'overview' ? undefined : t(`application.steps.${view}`);
    document.title = [title, t('application.title'), t('app.name')].filter(Boolean).join(' · ');
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [view, t]);
  useEffect(() => {
    setApplication(initial);
  }, [initial]);
  const submit = () =>
    run(async () => {
      setApplication(await api<Application>('/provider/application/submit', { method: 'POST' }));
    });
  return (
    <section className="onboarding" data-view={view === 'overview' ? 'overview' : 'task'}>
      <header className="onboarding__head">
        <h1 ref={heading} tabIndex={-1} id="application-title" className="flow__title">
          {t('application.title')}
        </h1>
        <p className="flow__muted">
          {t(keyFor('roles', application.role, 'application.title', '.label'))}
        </p>
      </header>
      <aside className="onboarding__rail" aria-labelledby="application-title">
        <StatusCard application={application} />
        <Checklist application={application} current={view} onSelect={setView} />
      </aside>
      <div className="onboarding__panel">
        {view === 'overview' ? (
          <Overview application={application} onSelect={setView} />
        ) : (
          <TaskPanel application={application} task={view} onSelect={setView}>
            {view === 'identity' && <IdentityStep application={application} />}
            {view === 'documents' && (
              <Documents application={application} onSaved={setApplication} />
            )}
            {view === 'payout' && <PayoutForm application={application} onSaved={setApplication} />}
            {view === 'review' && (
              <Submit application={application} pending={pending} onSubmit={submit} />
            )}
          </TaskPanel>
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

/** What to do next, with the saved-progress reassurance (Onboarding B's footer). */
function Overview({
  application,
  onSelect,
}: Readonly<{ application: Application; onSelect: (view: View) => void }>) {
  const { t } = useI18n();
  const next = application.editable ? nextTask(application) : undefined;
  return (
    <div className="onboarding__overview">
      <Notice tone={TONE[application.status]} live>
        {t(`application.statusText.${application.status}`)}
      </Notice>
      {next && (
        <div className="flow__actions">
          <Button
            className="flow__primary"
            onClick={() => {
              onSelect(next);
            }}
          >
            {t('application.continueTo', { step: t(`application.steps.${next}`) })}
          </Button>
        </div>
      )}
      {application.editable && (
        <>
          <p className="flow__muted">{t('application.reviewTime')}</p>
          <p className="flow__muted">{t('application.progressHint')}</p>
        </>
      )}
    </div>
  );
}

interface TaskPanelProps {
  application: Application;
  task: Task;
  onSelect: (view: View) => void;
  children: ReactNode;
}

/** One task on its own: its position (not completion), its content, and back and next. */
function TaskPanel({ application, task, onSelect, children }: Readonly<TaskPanelProps>) {
  const { t } = useI18n();
  const tasks = tasksFor(application);
  const index = tasks.indexOf(task);
  const next = tasks[index + 1];
  return (
    <div className="flow__card onboarding__task">
      <button
        type="button"
        className="heach-button heach-button--link onboarding__back"
        onClick={() => {
          onSelect('overview');
        }}
      >
        <Icon name="chevron-left" size={18} />
        {t('application.allSteps')}
      </button>
      <p className="onboarding__position">
        {t('application.stepOf', { current: index + 1, total: tasks.length })}
      </p>
      <h2 className="flow__subtitle onboarding__task-title">{t(`application.steps.${task}`)}</h2>
      {children}
      <div className="flow__actions onboarding__actions">
        <Button
          className="heach-button--secondary"
          onClick={() => {
            onSelect(tasks[index - 1] ?? 'overview');
          }}
        >
          {t('setup.back')}
        </Button>
        {next && (
          <Button
            className="flow__primary"
            onClick={() => {
              onSelect(next);
            }}
          >
            {t('setup.continue')}
          </Button>
        )}
      </div>
    </div>
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
  if (!application.editable) return <p>{t(`application.statusText.${application.status}`)}</p>;
  return (
    <>
      {application.missing.length > 0 && (
        <>
          <h3 className="onboarding__subhead">{t('application.missingTitle')}</h3>
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

function Documents({
  application,
  onSaved,
}: Readonly<{ application: Application; onSaved: (value: Application) => void }>) {
  return (
    <ul className="role-list">
      {application.items.map((entry) => (
        <li key={entry.key}>
          <DocumentItem entry={entry} editable={application.editable} onSaved={onSaved} />
        </li>
      ))}
    </ul>
  );
}
