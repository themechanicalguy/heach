'use client';

import { Notice } from '@heach/ui';
import type { Me } from '@heach/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAccount } from '../../lib/account';
import { useI18n } from '../../lib/i18n-context';
import { destinationFor } from '../../lib/routing';
import { usePending } from '../../lib/use-pending';
import { ConsentItems, toggled } from './ConsentItems';
import { StepActions } from './StepActions';

/** A returning user accepts a newer consent text before going on (PR-01, decision L-12). */
export function ConsentUpdate({ me }: Readonly<{ me: Me }>) {
  const { t } = useI18n();
  const router = useRouter();
  const { reload } = useAccount();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [showMissing, setShowMissing] = useState(false);
  const { pending, error, run } = usePending();

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setShowMissing(true);
    if (me.consentsDue.some(({ purpose }) => !accepted.has(purpose))) return;
    void run(async () => {
      await api('/me/consents', {
        method: 'POST',
        body: JSON.stringify({ consents: me.consentsDue }),
      });
      router.replace(destinationFor(await reload()));
    });
  };

  return (
    <section className="flow" aria-labelledby="consent-title">
      <form className="flow__card flow__form" onSubmit={submit} noValidate>
        <h1 id="consent-title" className="flow__title">
          {t('setup.consent.updatedTitle')}
        </h1>
        <p>{t('setup.consent.updatedIntro')}</p>
        <ConsentItems
          due={me.consentsDue}
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
        <StepActions submitLabel={t('setup.consent.accept')} pending={pending} />
      </form>
    </section>
  );
}
