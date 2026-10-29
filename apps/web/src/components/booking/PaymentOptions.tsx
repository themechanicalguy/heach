'use client';

import { formatPaise } from '@heach/i18n';
import type { Purchase, Referral } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { Select } from '../care/SearchView';

interface Props {
  purchaseId: string;
  couponId: string;
  onPurchase: (id: string) => void;
  onCoupon: (id: string) => void;
}

/** Pay with a plan's entitlement and one coupon (BK-08, RR-08); the server checks both. */
export function PaymentOptions({ purchaseId, couponId, onPurchase, onCoupon }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const plans = useResource<Purchase[]>(`/me/plans?locale=${locale}`);
  const referral = useResource<Referral>('/me/referral');
  const active =
    plans.resource.state === 'ready'
      ? plans.resource.data.filter((plan) => plan.status === 'active')
      : [];
  const coupons =
    referral.resource.state === 'ready'
      ? referral.resource.data.coupons.filter((coupon) => coupon.status === 'active')
      : [];
  return (
    <>
      {active.length > 0 && (
        <Select
          label={t('plans.usePlan')}
          value={purchaseId}
          onChange={onPurchase}
          options={[
            ['', t('plans.noPlan')],
            ...active.map((plan): [string, string] => [plan.id, plan.name]),
          ]}
        />
      )}
      {coupons.length > 0 && (
        <Select
          label={t('plans.useCoupon')}
          value={couponId}
          onChange={onCoupon}
          options={[
            ['', t('plans.noCoupon')],
            ...coupons.map((coupon): [string, string] => [
              coupon.id,
              formatPaise(coupon.valuePaise),
            ]),
          ]}
        />
      )}
    </>
  );
}
