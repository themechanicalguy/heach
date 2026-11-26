'use client';

import { formatDate } from '@heach/i18n';
import type { ConsentInForce } from '@heach/types';
import { Button, Card, Notice, Skeleton } from '@heach/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '../../lib/account';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

type Purpose = ConsentInForce['purpose'];

/**
 * The consents in force and a way to withdraw each (PR-01). Withdrawing needs no code, so it is as
 * easy as giving consent; the account reloads, and terms or privacy withdrawn are asked again
 * before the app can be used.
 */
export function ConsentsGiven() {
  const { locale, t } = useI18n();
  const { reload } = useAccount();
  const { pending, error, run } = usePending();
  const [consents, setConsents] = useState<ConsentInForce[]>();
  const [asking, setAsking] = useState<Purpose>();
  const [withdrawn, setWithdrawn] = useState(false);

  const refresh = useCallback(async () => {
    setConsents(await api<ConsentInForce[]>('/me/consents'));
  }, []);
  useEffect(() => {
    void run(refresh);
  }, [run, refresh]);

  const withdraw = (purpose: Purpose) =>
    run(async () => {
      await api(`/me/consents/${purpose}`, { method: 'DELETE' });
      setAsking(undefined);
      setWithdrawn(true);
      await refresh();
      await reload();
    });

  return (
    <section className="flow__card" aria-labelledby="consents-title">
      <h2 id="consents-title" className="flow__subtitle">
        {t('dataRights.consents.title')}
      </h2>
      <p>{t('dataRights.consents.intro')}</p>
      {!consents && !error && <Skeleton label={t('state.loading')} />}
      {consents?.length === 0 && <p>{t('dataRights.consents.none')}</p>}
      <ul className="role-list">
        {consents?.map((consent) => (
          <li key={consent.purpose}>
            <Card title={t(`dataRights.consents.purpose.${consent.purpose}`)}>
              <p>
                {t('dataRights.consents.given', {
                  date: formatDate(new Date(consent.givenAt), locale),
                })}
              </p>
              {asking === consent.purpose ? (
                <Confirm
                  purpose={consent.purpose}
                  pending={pending}
                  onYes={() => void withdraw(consent.purpose)}
                  onKeep={() => {
                    setAsking(undefined);
                  }}
                />
              ) : (
                <Button
                  className="heach-button--secondary"
                  onClick={() => {
                    setAsking(consent.purpose);
                    setWithdrawn(false);
                  }}
                  disabled={pending}
                >
                  {t('dataRights.consents.withdraw')}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {withdrawn && (
        <Notice tone="info" live>
          {t('dataRights.consents.withdrawn')}
        </Notice>
      )}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
    </section>
  );
}

interface ConfirmProps {
  purpose: Purpose;
  pending: boolean;
  onYes: () => void;
  onKeep: () => void;
}

/** Says what withdrawing this consent means before it is done. */
function Confirm({ purpose, pending, onYes, onKeep }: Readonly<ConfirmProps>) {
  const { t } = useI18n();
  return (
    <>
      <Notice tone="warning" live>
        {t(`dataRights.consents.confirm.${purpose}`)}
      </Notice>
      <Button className="heach-button--danger" onClick={onYes} disabled={pending}>
        {t('dataRights.consents.yes')}
      </Button>
      <Button className="heach-button--secondary" onClick={onKeep} disabled={pending}>
        {t('dataRights.consents.keep')}
      </Button>
    </>
  );
}
