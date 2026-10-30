'use client';

import { formatDate, formatDateTime } from '@heach/i18n';
import { EmptyState } from '@heach/ui';
import type { Earnings } from '@heach/types';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { money } from '../booking/money';

/** The provider's earnings ledger and payout status (PY-04, PY-05). */
export function EarningsView() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<Earnings>('/provider/earnings');
  return (
    <section className="flow" aria-labelledby="earnings-title">
      <div className="flow__card">
        <h1 id="earnings-title" className="flow__title">
          {t('earnings.title')}
        </h1>
        <p>
          <Link href={`/${locale}/referral`}>{t('earnings.invite')}</Link>
        </p>
        <ResourceView resource={resource} reload={reload}>
          {(data) => (
            <>
              <p>
                <strong>{t('earnings.balance', { amount: money(data.balancePaise) })}</strong>
              </p>
              {data.heldPaise > 0 && (
                <p className="flow__muted">
                  {t('earnings.held', { amount: money(data.heldPaise) })}
                </p>
              )}
              <p>{t('earnings.paidOut', { amount: money(data.paidOutPaise) })}</p>
              <p className="flow__muted">
                {t('earnings.next', { time: formatDateTime(new Date(data.nextPayoutAt), locale) })}
              </p>
              {data.lines.length === 0 ? (
                <EmptyState message={t('earnings.empty')} />
              ) : (
                <ul>
                  {data.lines.map((line, index) => (
                    <li key={`${line.createdAt}-${String(index)}`}>
                      {formatDate(new Date(line.createdAt), locale)} ·{' '}
                      {t(keyFor('earnings.kind', line.kind, 'earnings.title'))} ·{' '}
                      {money(line.amountPaise)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </ResourceView>
      </div>
    </section>
  );
}
