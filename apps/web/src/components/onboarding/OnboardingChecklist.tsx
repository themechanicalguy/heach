'use client';

import type { Application } from '@heach/types';
import { Icon, Progress } from '@heach/ui';
import { useI18n } from '../../lib/i18n-context';
import {
  doneCount,
  documentsUploaded,
  nextTask,
  type Task,
  type TaskState,
  taskState,
  tasksFor,
} from './tasks';

/** The purple completion card: tasks done (not the step on screen) and the application status. */
export function StatusCard({ application }: Readonly<{ application: Application }>) {
  const { t } = useI18n();
  const total = tasksFor(application).length;
  const done = doneCount(application);
  const label = t('application.completion', { done, total });
  return (
    <div className="status-card">
      <Progress label={label} current={done} total={total} min={0} />
      <p className="status-card__line">
        <span>{t('application.statusLabel')}</span>
        <strong>{t(`application.status.${application.status}`)}</strong>
      </p>
    </div>
  );
}

function detail(application: Application, task: Task, t: ReturnType<typeof useI18n>['t']) {
  if (task === 'identity') return t(`application.identityState.${application.identity}`);
  if (task === 'documents') return t('application.documentsCount', documentsUploaded(application));
  if (task === 'payout')
    return t(
      application.payout ? 'application.payoutState.added' : 'application.payoutState.missing',
    );
  return t(`application.status.${application.status}`);
}

function sideLabel(state: TaskState, isNext: boolean, t: ReturnType<typeof useI18n>['t']) {
  if (state === 'done') return t('application.stepDone');
  if (isNext && state === 'todo') return t('application.taskState.start');
  return t(`application.taskState.${state}`);
}

function Marker({ state, index }: Readonly<{ state: TaskState; index: number }>) {
  if (state === 'done') return <Icon name="check" size={18} />;
  if (state === 'review') return <Icon name="clock" size={18} />;
  if (state === 'attention') return <span aria-hidden="true">!</span>;
  return <span aria-hidden="true">{String(index + 1)}</span>;
}

interface ChecklistProps {
  application: Application;
  current: Task | 'overview';
  onSelect: (task: Task) => void;
}

/**
 * The application's tasks with distinct done, in review, needs attention and next states
 * (Onboarding B). The next task is outlined and offers Start; the open one is marked current.
 */
export function Checklist({ application, current, onSelect }: Readonly<ChecklistProps>) {
  const { t } = useI18n();
  const next = nextTask(application);
  return (
    <ol className="checklist">
      {tasksFor(application).map((task, index) => {
        const state = taskState(application, task);
        const isNext = task === next && application.editable;
        const side = sideLabel(state, isNext, t);
        return (
          <li key={task}>
            <button
              type="button"
              className="checklist__item"
              data-state={state}
              data-next={isNext || undefined}
              aria-current={current === task ? 'step' : undefined}
              onClick={() => {
                onSelect(task);
              }}
            >
              <span className="checklist__number">
                <Marker state={state} index={index} />
              </span>
              <span className="checklist__label">
                {t(`application.steps.${task}`)}
                <span className="checklist__detail">{detail(application, task, t)}</span>
              </span>
              <span className="checklist__state">
                {side}
                {isNext && <Icon name="chevron-right" size={16} />}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
