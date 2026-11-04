'use client';

import { formatDateTime, formatPaise, isLocale } from '@heach/i18n';
import { Card } from '@heach/ui';
import type { SearchResult } from '@heach/types';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n-context';

/** Search only returns approved providers serving the requested PIN (SD-04). */
export function ProviderCard({ result }: Readonly<{ result: SearchResult }>) {
  const { locale, t } = useI18n();
  return (
    <Card title={result.name}>
      <p>{result.itemName}</p>
      <p className="site-badge">{t('site.verified')}</p>
      <p>{t('site.servesPin')}</p>
      <p>
        {result.languages
          .map((code) => (isLocale(code) ? t(`languages.${code}`) : code))
          .join(', ')}
      </p>
      <p className="flow__muted">
        {t('site.from', { fee: formatPaise(result.feePaise) })}
        {result.travelSurchargePaise > 0 &&
          ` ${t('search.surcharge', { fee: formatPaise(result.travelSurchargePaise) })}`}
      </p>
      <p className="flow__muted">
        {result.earliestSlot
          ? t('search.earliest', { time: formatDateTime(new Date(result.earliestSlot), locale) })
          : t('search.noSlot')}
      </p>
      <Link
        className="heach-button"
        href={`/${locale}/providers/${result.providerId}?listing=${result.listingId}`}
      >
        {t('search.view')}
      </Link>
    </Card>
  );
}
