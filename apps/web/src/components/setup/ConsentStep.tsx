'use client';

import { Button, Notice } from '@heach/ui';
import type { AccessToken, Consent } from '@heach/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAccount } from '../../lib/account';
import { useI18n } from '../../lib/i18n-context';
import { destinationFor } from '../../lib/routing';
import { useSession } from '../../lib/session';
import { usePending } from '../../lib/use-pending';
import { ConsentItems, toggled } from './ConsentItems';

/** Last setup step: versioned consent, then the server grants the role (PR-01, decision L-3). */
export function ConsentStep({ due }: Readonly<{ due: readonly Consent[] }>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { adoptToken } = useSession();
  const { reload } = useAccount();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [showMissing, setShowMissing] = useState(false);
  const { pending, error, run } = usePending();

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setShowMissing(true);
    if (due.some(({ purpose }) => !accepted.has(purpose))) return;
    void run(async () => {
      const { accessToken } = await api<AccessToken>('/me/setup/complete', {
        method: 'POST',
        body: JSON.stringify({ consents: due }),
      });
      adoptToken(accessToken);
      router.replace(destinationFor(await reload()));
    });
  };

  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <p>{t('setup.consent.intro')}</p>
      <ConsentItems
        due={due}
        accepted={accepted}
        showMissing={showMissing}
        onToggle={(purpose, checked) => {
          setAccepted((current) => toggled(current, purpose, checked));
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <div className="flow__actions">
        <Button
          className="heach-button--secondary"
          onClick={() => {
            router.push(`/${locale}/setup/details`);
          }}
        >
          {t('setup.back')}
        </Button>
        <Button type="submit" className="flow__primary" disabled={pending} aria-busy={pending}>
          {t('setup.consent.finish')}
        </Button>
      </div>
    </form>
  );
}
