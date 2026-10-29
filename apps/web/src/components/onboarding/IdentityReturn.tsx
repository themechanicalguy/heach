'use client';

import { Notice, Skeleton } from '@heach/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';

/** Where the identity partner sends the provider back: completes the check once, then returns. */
export function IdentityReturn() {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const sent = useRef(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const body = JSON.stringify({
      code: params.get('code') ?? '',
      reference: params.get('ref') ?? '',
    });
    api('/provider/application/identity/complete', { method: 'POST', body })
      .then(() => {
        router.replace(`/${locale}/provider`);
      })
      .catch((caught: unknown) => {
        setError(t(errorMessageKey(caught)));
      });
  }, [params, router, locale, t]);

  return error ? (
    <Notice tone="danger" live>
      {error}
    </Notice>
  ) : (
    <Skeleton label={t('application.identityReturning')} />
  );
}
