'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, EmptyState, Notice } from '@heach/ui';
import type { ProviderRequest, StoredFile } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { Select } from '../care/SearchView';
import { money } from '../booking/money';

const DECLINE_REASONS = ['unavailable', 'too_far', 'prescription_invalid', 'other'] as const;

/** Open booking requests (BK-03, HS-01, A10, A14): accept, or decline with a reason. */
export function RequestsView() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<ProviderRequest[]>(
    `/provider/requests?locale=${locale}`,
  );
  return (
    <section className="flow" aria-labelledby="requests-title">
      <div className="flow__card">
        <h1 id="requests-title" className="flow__title">
          {t('requests.title')}
        </h1>
        <p>{t('requests.intro')}</p>
        <ResourceView resource={resource} reload={reload}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState message={t('requests.empty')} />
            ) : (
              <ul className="role-list">
                {rows.map((row) => (
                  <li key={row.bookingId}>
                    <RequestCard request={row} onDone={reload} />
                  </li>
                ))}
              </ul>
            )
          }
        </ResourceView>
      </div>
    </section>
  );
}

function RequestCard({
  request,
  onDone,
}: Readonly<{ request: ProviderRequest; onDone: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  const [why, setWhy] = useState<string>('unavailable');
  const [file, setFile] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  const answer = (path: string, body?: object) =>
    run(async () => {
      await api(`/provider/requests/${request.bookingId}/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await onDone();
    });
  const viewPrescription = () =>
    run(async () => {
      const stored = await api<StoredFile>(`/provider/requests/${request.bookingId}/prescription`);
      setFile(`data:${stored.contentType};base64,${stored.contentBase64}`);
    });
  return (
    <Card title={request.itemName}>
      <p>{formatDateTime(new Date(request.startsAt), locale)}</p>
      <p className="flow__muted">{t('requests.area', { pin: request.pin })}</p>
      <p>{t('requests.earning', { amount: money(request.earningPaise) })}</p>
      {request.acceptBy && (
        <p className="flow__muted">
          {t('requests.acceptBy', { time: formatDateTime(new Date(request.acceptBy), locale) })}
        </p>
      )}
      {request.notes && <p>{t('requests.notes', { notes: request.notes })}</p>}
      {request.hasPrescription &&
        (file ? (
          <a href={file} target="_blank" rel="noreferrer">
            {t('requests.prescription')}
          </a>
        ) : (
          <Button
            className="heach-button--secondary"
            onClick={() => void viewPrescription()}
            disabled={pending}
          >
            {t('requests.prescription')}
          </Button>
        ))}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button onClick={() => void answer('accept')} disabled={pending}>
        {t('requests.accept')}
      </Button>
      <Select
        label={t('requests.declineReason')}
        value={why}
        onChange={setWhy}
        options={DECLINE_REASONS.map((value) => [value, t(`bookings.reasons.${value}`)] as const)}
      />
      <Button
        className="heach-button--secondary"
        onClick={() => void answer('decline', { reason: why })}
        disabled={pending}
      >
        {t('requests.decline')}
      </Button>
    </Card>
  );
}
