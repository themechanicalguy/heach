'use client';

import { Notice, Progress } from '@heach/ui';
import type { Me, RoleGrant } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';

const STEPS = ['account', 'identity', 'documents', 'profile', 'area', 'payout', 'review'] as const;
type Status = NonNullable<RoleGrant['applicationStatus']>;
const TONE: Record<Status, 'info' | 'warning' | 'danger' | 'success'> = {
  draft: 'info',
  submitted: 'info',
  under_review: 'warning',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

/**
 * The provider's application (PO-04), as the design's checklist hub. Account setup is the first
 * step and done; identity, documents, profile, area and payout are the wider verification that
 * later slices build (decision L-5), shown as not open yet, never as working fakes.
 */
export function ApplicationStatus({ me }: Readonly<{ me: Me }>) {
  const { t } = useI18n();
  const grant = me.roles.find((role) => role.side === 'provider');
  const status: Status = grant?.applicationStatus ?? 'draft';
  const done = 1;
  return (
    <section className="flow" aria-labelledby="application-title">
      <div className="flow__card">
        <h1 id="application-title" className="flow__title">
          {t('application.title')}
        </h1>
        {grant && <p className="flow__muted">{t(`roles.${grant.role}.label`)}</p>}
        <div className="status-card">
          <p className="status-card__line">
            <span>{t('application.statusLabel')}</span>
            <strong>{t(`application.status.${status}`)}</strong>
          </p>
          <Progress
            current={done}
            total={STEPS.length}
            label={t('application.progress', { done, total: STEPS.length })}
          />
        </div>
        <Notice tone={TONE[status]} live>
          {t(`application.statusText.${status}`)}
        </Notice>
        <h2 className="flow__subtitle">{t('application.stepsTitle')}</h2>
        <ol className="checklist">
          {STEPS.map((step, index) => (
            <li key={step} className="checklist__item" data-done={index < done}>
              <span className="checklist__number" aria-hidden="true">
                {index < done ? '✓' : String(index + 1)}
              </span>
              <span className="checklist__label">{t(`application.steps.${step}`)}</span>
              <span className="checklist__state">
                {index < done ? t('application.stepDone') : t('application.stepNotOpen')}
              </span>
            </li>
          ))}
        </ol>
        <p className="flow__muted">{t('application.reviewTime')}</p>
      </div>
    </section>
  );
}
