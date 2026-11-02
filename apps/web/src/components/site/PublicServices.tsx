'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { formatPaise } from '@heach/i18n';
import type { ServicePrice } from '@heach/types';
import { useResource } from '../../lib/use-resource';
import { useSession } from '../../lib/session';
import { useAccount } from '../../lib/account';
import { useI18n } from '../../lib/i18n-context';

const Prices = createContext<readonly ServicePrice[]>([]);

/** Only mounted once the public service cards are shown. */
export function PublicServices({ children }: Readonly<{ children: ReactNode }>) {
  const { status } = useSession();
  const { enabled } = useAccount();
  const { resource } = useResource<ServicePrice[]>(
    '/service-prices',
    undefined,
    !enabled || status === 'signed-out',
  );
  return <Prices value={resource.state === 'ready' ? resource.data : []}>{children}</Prices>;
}

export function StartingPrice({ service }: Readonly<{ service: string }>) {
  const prices = useContext(Prices);
  const { t } = useI18n();
  const price = prices.find((row) => row.service === service);
  return (
    <span className="flow__muted">
      {price ? t('site.from', { fee: formatPaise(price.feePaise) }) : t('site.pricePending')}
    </span>
  );
}
