'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, CheckboxField, EmptyState, Notice, TextField } from '@heach/ui';
import type { RecordShare, SharedRecords, VaultRecord } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { RecordCard } from './RecordCard';
import { RecordPicker } from './VaultView';

/** The patient shares chosen records with this booking's provider, and can revoke (MV-07). */
export function ShareWithBooking({ bookingId }: Readonly<{ bookingId: string }>) {
  const { locale, t } = useI18n();
  const records = useResource<VaultRecord[]>('/vault');
  const shares = useResource<RecordShare[]>('/vault/shares');
  const [chosen, setChosen] = useState<string[]>([]);
  const [history, setHistory] = useState(false);
  const { pending, error, run } = usePending();
  if (records.resource.state !== 'ready' || records.resource.data.length === 0) return null;
  const live =
    shares.resource.state === 'ready'
      ? shares.resource.data.filter((share) => share.bookingId === bookingId && !share.revokedAt)
      : [];
  return (
    <Card title={t('vault.shareTitle')}>
      {live.map((share) => (
        <p key={share.id}>
          {t('vault.shared', { time: formatDateTime(new Date(share.expiresAt), locale) })}{' '}
          <Button
            className="heach-button--secondary"
            disabled={pending}
            onClick={() =>
              void run(async () => {
                await api(`/vault/shares/${share.id}/revoke`, { method: 'POST' });
                await shares.reload();
              })
            }
          >
            {t('vault.revoke')}
          </Button>
        </p>
      ))}
      <RecordPicker records={records.resource.data} chosen={chosen} onChange={setChosen} />
      <CheckboxField
        label={t('vault.shareHistory')}
        checked={history}
        onChange={(event) => {
          setHistory(event.currentTarget.checked);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        disabled={pending || (chosen.length === 0 && !history)}
        onClick={() =>
          void run(async () => {
            await api('/vault/shares', {
              method: 'POST',
              body: JSON.stringify({ bookingId, recordIds: chosen, includeHistory: history }),
            });
            setChosen([]);
            await shares.reload();
          })
        }
      >
        {t('vault.share')}
      </Button>
    </Card>
  );
}

/** The provider's "Shared records" panel (MV-08) and adding a record to the patient's file (MV-14). */
export function SharedRecordsPanel({ bookingId }: Readonly<{ bookingId: string }>) {
  const { t } = useI18n();
  const { resource } = useResource<SharedRecords>(`/provider/bookings/${bookingId}/shared`);
  const [title, setTitle] = useState('');
  const [added, setAdded] = useState(false);
  const { pending, error, run } = usePending();
  const shared = resource.state === 'ready' ? resource.data : undefined;
  return (
    <Card title={t('sharedPanel.title')}>
      {shared?.records.length === 0 && shared.history.length === 0 && (
        <EmptyState message={t('sharedPanel.empty')} />
      )}
      {shared?.records.map((record) => (
        <RecordCard
          key={record.id}
          record={record}
          filePath={`/provider/bookings/${bookingId}/shared/${record.id}/file`}
        />
      ))}
      {shared && shared.history.length > 0 && (
        <>
          <h3 className="flow__subtitle">{t('sharedPanel.history')}</h3>
          <ul>
            {shared.history.map((entry) => (
              <li key={entry.id}>
                {t(keyFor('vault.kinds', entry.kind, 'vault.historyTitle'))}: {entry.text}
              </li>
            ))}
          </ul>
        </>
      )}
      <TextField
        label={t('sharedPanel.add')}
        value={title}
        onChange={(event) => {
          setTitle(event.currentTarget.value);
          setAdded(false);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {added && (
        <Notice tone="success" live>
          {t('sharedPanel.added')}
        </Notice>
      )}
      <Button
        className="heach-button--secondary"
        disabled={pending || !title}
        onClick={() =>
          void run(async () => {
            await api(`/provider/bookings/${bookingId}/records`, {
              method: 'POST',
              body: JSON.stringify({ recordType: 'other', title }),
            });
            setTitle('');
            setAdded(true);
          })
        }
      >
        {t('vault.save')}
      </Button>
    </Card>
  );
}

/** A doctor outside HEACH opens a shared link with its code (MV-09). No account needed. */
export function SharedLinkView({ token }: Readonly<{ token: string }>) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [shared, setShared] = useState<SharedRecords | undefined>();
  const { pending, error, run } = usePending();
  const fileFor = (recordId: string) => shared?.files.find((file) => file.recordId === recordId);
  return (
    <section className="flow" aria-labelledby="shared-title">
      <div className="flow__card">
        <h1 id="shared-title" className="flow__title">
          {t('sharedLink.title')}
        </h1>
        {shared ? (
          <ul className="role-list">
            {shared.records.map((record) => {
              const file = fileFor(record.id);
              return (
                <li key={record.id}>
                  <Card title={record.title}>
                    <p className="flow__muted">
                      {t(keyFor('vault.types', record.recordType, 'vault.types.other'))} ·{' '}
                      {record.recordDate}
                    </p>
                    {record.notes && <p>{record.notes}</p>}
                    {file && (
                      <a
                        href={`data:${file.contentType};base64,${file.contentBase64}`}
                        download={`${record.title}.pdf`}
                      >
                        {t('sharedLink.download')}
                      </a>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <>
            <p>{t('sharedLink.intro')}</p>
            <TextField
              label={t('sharedLink.code')}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.currentTarget.value.trim());
              }}
            />
            {error && (
              <Notice tone="danger" live>
                {t(error)}
              </Notice>
            )}
            <Button
              disabled={pending || code.length !== 6}
              onClick={() =>
                void run(async () => {
                  setShared(
                    await api<SharedRecords>(`/shared-records/${token}`, {
                      method: 'POST',
                      body: JSON.stringify({ code }),
                    }),
                  );
                })
              }
            >
              {t('sharedLink.open')}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
