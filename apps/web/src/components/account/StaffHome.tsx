'use client';

import { Notice } from '@heach/ui';
import type { Me } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';

/**
 * The home of clinic front desk staff and sample collectors (owner decision O-1): which lab or
 * clinic they belong to, and whether its work is open. Lab and clinic work arrive in Step 7; they
 * are described, never shown as working controls.
 */
export function StaffHome({ me }: Readonly<{ me: Me }>) {
  const { t } = useI18n();
  const membership = me.membership;
  return (
    <section className="flow" aria-labelledby="staff-title">
      <div className="flow__card">
        <h1 id="staff-title" className="flow__title">
          {t('staff.title')}
        </h1>
        {membership ? (
          <>
            <dl className="facts">
              <dt>{t(`staff.organisation.${membership.organisationKind}`)}</dt>
              <dd>{membership.organisationName}</dd>
              <dt>{t('staff.role')}</dt>
              <dd>{t(`roles.${membership.role}.label`)}</dd>
            </dl>
            <Notice tone={membership.organisationApproved ? 'success' : 'info'} live>
              {t(membership.organisationApproved ? 'staff.approved' : 'staff.notApproved')}
            </Notice>
            <p className="flow__muted">{t('staff.workLater')}</p>
            {membership.role === 'sample_collector' && (
              <p className="flow__muted">{t('staff.collectorVerification')}</p>
            )}
          </>
        ) : (
          <Notice tone="warning">{t('staff.noMembership')}</Notice>
        )}
      </div>
    </section>
  );
}
