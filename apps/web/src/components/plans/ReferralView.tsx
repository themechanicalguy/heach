'use client';

import { formatDate, formatDateTime, formatPaise } from '@heach/i18n';
import { Button, Card, Notice, TextField } from '@heach/ui';
import type { Referral } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

/**
 * The referral code and share links (RR-01), invitees' status (RR-07) and coupons (RR-08). For a
 * provider, other providers are invited and the reward is a commission discount (RR-04).
 */
export function ReferralView({ provider = false }: Readonly<{ provider?: boolean }>) {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<Referral>('/me/referral');
  const [copied, setCopied] = useState(false);
  return (
    <section className="flow" aria-labelledby="referral-title">
      <div className="flow__card">
        <h1 id="referral-title" className="flow__title">
          {t('referral.title')}
        </h1>
        <p>{t(provider ? 'referral.providerIntro' : 'referral.intro')}</p>
        <ResourceView resource={resource} reload={reload}>
          {(referral) => {
            const link = `${window.location.origin}/${locale}?ref=${referral.code}`;
            const message = encodeURIComponent(`${t('referral.intro')} ${link}`);
            return (
              <>
                <p className="visit-code">{t('referral.code', { code: referral.code })}</p>
                <div className="flow__actions">
                  <Button
                    className="heach-button--secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(link).then(() => {
                        setCopied(true);
                      });
                    }}
                  >
                    {t('referral.copy')}
                  </Button>
                  <a
                    className="heach-button heach-button--secondary"
                    href={`https://wa.me/?text=${message}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('referral.whatsapp')}
                  </a>
                  <a className="heach-button heach-button--secondary" href={`sms:?body=${message}`}>
                    {t('referral.sms')}
                  </a>
                </div>
                {copied && (
                  <Notice tone="success" live>
                    {t('referral.copied')}
                  </Notice>
                )}
                {!referral.invited && <JoinForm onJoined={reload} />}
                <h2 className="flow__subtitle">{t('referral.invitees')}</h2>
                <ul>
                  {referral.invitees.map((invitee, index) => (
                    <li key={`${invitee.joinedAt}-${String(index)}`}>
                      {t('referral.invitee', {
                        time: formatDate(new Date(invitee.joinedAt), locale),
                        status: t(
                          keyFor('referral.inviteeStatus', invitee.status, 'referral.invitees'),
                        ),
                      })}
                    </li>
                  ))}
                </ul>
                {provider && (
                  <p>{t('referral.creditsLeft', { count: referral.commissionCreditBookings })}</p>
                )}
                {!provider && <Coupons coupons={referral.coupons} />}
              </>
            );
          }}
        </ResourceView>
      </div>
    </section>
  );
}

function JoinForm({ onJoined }: Readonly<{ onJoined: () => Promise<void> }>) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState(false);
  const { pending, error, run } = usePending();
  if (joined)
    return (
      <Notice tone="success" live>
        {t('referral.joined')}
      </Notice>
    );
  return (
    <Card title={t('referral.haveCode')}>
      <TextField
        label={t('referral.haveCode')}
        maxLength={8}
        value={code}
        onChange={(event) => {
          setCode(event.currentTarget.value.trim().toUpperCase());
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        disabled={pending || code.length !== 8}
        onClick={() =>
          void run(async () => {
            await api('/me/referral/join', { method: 'POST', body: JSON.stringify({ code }) });
            setJoined(true);
            await onJoined();
          })
        }
      >
        {t('referral.join')}
      </Button>
    </Card>
  );
}

function Coupons({ coupons }: Readonly<{ coupons: Referral['coupons'] }>) {
  const { locale, t } = useI18n();
  return (
    <>
      <h2 className="flow__subtitle">{t('referral.coupons')}</h2>
      {coupons.length === 0 ? (
        <p className="flow__muted">{t('referral.noCoupons')}</p>
      ) : (
        <ul>
          {coupons.map((coupon) => (
            <li key={coupon.id}>
              {t('referral.coupon', {
                value: formatPaise(coupon.valuePaise),
                time: formatDateTime(new Date(coupon.expiresAt), locale),
              })}{' '}
              · {t(keyFor('referral.couponStatus', coupon.status, 'referral.coupons'))}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
