'use client';

import { formatDateTime, formatPaise } from '@heach/i18n';
import { Button, Card, CheckboxField, EmptyState, Notice } from '@heach/ui';
import type { Plan, Purchase, PurchaseCheckout } from '@heach/types';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

/** Care plans (J8; PK-01 to PK-08): terms before purchase, buying, and the patient's own plans. */
export function PlansView() {
  const { locale, t } = useI18n();
  const plans = useResource<Plan[]>(`/plans?locale=${locale}`);
  const mine = useResource<Purchase[]>(`/me/plans?locale=${locale}`);
  return (
    <section className="flow" aria-labelledby="plans-title">
      <div className="flow__card">
        <h1 id="plans-title" className="flow__title">
          {t('plans.title')}
        </h1>
        <p>{t('plans.intro')}</p>
        <Link href={`/${locale}/referral`}>{t('referral.title')}</Link>
        <ResourceView resource={plans.resource} reload={plans.reload}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState message={t('plans.empty')} />
            ) : (
              <ul className="role-list">
                {rows.map((plan) => (
                  <li key={plan.id}>
                    <PlanCard plan={plan} onBought={mine.reload} />
                  </li>
                ))}
              </ul>
            )
          }
        </ResourceView>
        <h2 className="flow__subtitle">{t('plans.mine')}</h2>
        <ResourceView resource={mine.resource} reload={mine.reload}>
          {(rows) => (
            <ul className="role-list">
              {rows.map((purchase) => (
                <li key={purchase.id}>
                  <PurchaseCard purchase={purchase} onChanged={mine.reload} />
                </li>
              ))}
            </ul>
          )}
        </ResourceView>
      </div>
    </section>
  );
}

function PlanCard({ plan, onBought }: Readonly<{ plan: Plan; onBought: () => Promise<void> }>) {
  const { t } = useI18n();
  const { pending, error, run } = usePending();
  const buy = () =>
    run(async () => {
      const checkout = await api<PurchaseCheckout>(`/plans/${plan.id}/purchase`, {
        method: 'POST',
      });
      await api(`/payments/sandbox/${checkout.orderId}/pay`, { method: 'POST' });
      await onBought();
    });
  return (
    <Card title={plan.name}>
      <p className="flow__muted">
        {t(plan.kind === 'package' ? 'plans.package' : 'plans.subscription')}
        {plan.providerName && ` · ${t('plans.by', { name: plan.providerName })}`}
      </p>
      <p>{t('plans.units', { units: plan.units })}</p>
      <p>{t('plans.validity', { days: plan.validityDays })}</p>
      {plan.familyMembers > 0 && <p>{t('plans.family', { count: plan.familyMembers })}</p>}
      {plan.discountPercent > 0 && <p>{t('plans.discount', { percent: plan.discountPercent })}</p>}
      <p>{t('plans.includes', { text: plan.inclusions })}</p>
      <p>{t('plans.excludes', { text: plan.exclusions })}</p>
      <p className="flow__muted">{t('plans.terms')}</p>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button onClick={() => void buy()} disabled={pending}>
        {t('plans.buy', { amount: formatPaise(plan.pricePaise) })}
      </Button>
    </Card>
  );
}

function PurchaseCard({
  purchase,
  onChanged,
}: Readonly<{ purchase: Purchase; onChanged: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = usePending();
  const active = purchase.status === 'active';
  return (
    <Card title={purchase.name}>
      <p>
        <strong>{t(keyFor('plans.status', purchase.status, 'plans.title'))}</strong>
        {purchase.endsAt &&
          ` · ${t('plans.ends', { time: formatDateTime(new Date(purchase.endsAt), locale) })}`}
      </p>
      {purchase.entitlements.map((entitlement) => (
        <p key={entitlement.id}>
          {t('plans.left', {
            left: entitlement.unitsTotal - entitlement.unitsUsed,
            total: entitlement.unitsTotal,
          })}
        </p>
      ))}
      {purchase.renewalPaused && <Notice tone="warning">{t('plans.renewalPaused')}</Notice>}
      {active && purchase.kind === 'subscription' && (
        <CheckboxField
          label={t('plans.autoRenew')}
          checked={purchase.autoRenew}
          disabled={pending}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            void run(async () => {
              await api(`/me/plans/${purchase.id}/auto-renew`, {
                method: 'POST',
                body: JSON.stringify({ enabled }),
              });
              await onChanged();
            });
          }}
        />
      )}
      {active && purchase.kind === 'subscription' && <p>{t('plans.autoRenewHint')}</p>}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {active && !confirming && (
        <Button
          className="heach-button--secondary"
          onClick={() => {
            setConfirming(true);
          }}
        >
          {t('plans.cancel')}
        </Button>
      )}
      {active && confirming && (
        <>
          <p>{t('plans.cancelRefund', { amount: formatPaise(purchase.refundIfCancelledPaise) })}</p>
          <Button
            className="heach-button--danger"
            disabled={pending}
            onClick={() =>
              void run(async () => {
                await api(`/me/plans/${purchase.id}/cancel`, { method: 'POST' });
                setConfirming(false);
                await onChanged();
              })
            }
          >
            {t('plans.cancel')}
          </Button>
        </>
      )}
    </Card>
  );
}
