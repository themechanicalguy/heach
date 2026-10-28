'use client';

import { Progress } from '@heach/ui';
import type { ReactNode } from 'react';
import { useI18n } from '../../lib/i18n-context';
import type { SetupStep } from '../../lib/routing';
import { SETUP_STEPS } from '../../lib/routing';

const TITLES = {
  role: 'setup.role.title',
  details: 'setup.details.title',
  consent: 'setup.consent.title',
} as const;

/** One step per screen with progress (design reference, onboarding A; steps beside on desktop). */
export function SetupFrame({ step, children }: Readonly<{ step: SetupStep; children: ReactNode }>) {
  const { t } = useI18n();
  const current = SETUP_STEPS.indexOf(step) + 1;
  const label = t('setup.progress', { current, total: SETUP_STEPS.length });
  return (
    <section className="flow flow--steps" aria-labelledby="setup-title">
      <nav className="flow__steps" aria-label={label}>
        <ol>
          {SETUP_STEPS.map((each, index) => (
            <li
              key={each}
              aria-current={each === step ? 'step' : undefined}
              data-done={index + 1 < current}
            >
              <span className="flow__step-number" aria-hidden="true">
                {index + 1}
              </span>
              <span>{t(TITLES[each])}</span>
            </li>
          ))}
        </ol>
      </nav>
      <div className="flow__card">
        <Progress current={current} total={SETUP_STEPS.length} label={label} />
        <h1 id="setup-title" className="flow__title">
          {t(TITLES[step])}
        </h1>
        {children}
      </div>
    </section>
  );
}
