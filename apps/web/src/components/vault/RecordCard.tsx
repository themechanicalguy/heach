'use client';

import { formatDate, formatDateTime } from '@heach/i18n';
import { Button, Card } from '@heach/ui';
import type { RecordAccess, StoredFile, VaultRecord } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';

interface Props {
  record: VaultRecord;
  /** Where the file comes from: the owner's vault or a provider's share. */
  filePath?: string | undefined;
  onDelete?: (() => Promise<void>) | undefined;
  showAccess?: boolean;
}

/** One record (MV-04): type, date, who added or issued it, tags, notes and the file. */
export function RecordCard({ record, filePath, onDelete, showAccess = false }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const [href, setHref] = useState<string | undefined>();
  const [access, setAccess] = useState<RecordAccess[] | undefined>();
  const { pending, run } = usePending();
  const open = () =>
    run(async () => {
      const file = await api<StoredFile>(filePath ?? `/vault/records/${record.id}/file`);
      setHref(`data:${file.contentType};base64,${file.contentBase64}`);
    });
  return (
    <Card title={record.title}>
      <p className="flow__muted">
        {t(keyFor('vault.types', record.recordType, 'vault.types.other'))} ·{' '}
        {formatDate(new Date(`${record.recordDate}T00:00:00+05:30`), locale)}
      </p>
      <p className="flow__muted">
        {record.source === 'patient'
          ? t('vault.addedByYou')
          : t('vault.issuedBy', { name: record.issuedBy ?? record.facility ?? '' })}
      </p>
      {record.tags.length > 0 && <p>{record.tags.join(', ')}</p>}
      {record.notes && <p>{record.notes}</p>}
      {record.visitNotes && (
        <dl className="facts">
          <dt>{t('visit.procedure')}</dt>
          <dd>{record.visitNotes.procedure}</dd>
          <dt>{t('visit.observations')}</dt>
          <dd>{record.visitNotes.observations}</dd>
          <dt>{t('visit.advice')}</dt>
          <dd>{record.visitNotes.advice}</dd>
        </dl>
      )}
      {record.hasFile &&
        (href ? (
          <a href={href} download={`${record.title}.pdf`}>
            {t('vault.download')}
          </a>
        ) : (
          <Button
            className="heach-button--secondary"
            onClick={() => void open()}
            disabled={pending}
          >
            {t('vault.download')}
          </Button>
        ))}
      {showAccess && (
        <Button
          className="heach-button--secondary"
          onClick={() =>
            void run(async () => {
              setAccess(await api<RecordAccess[]>(`/vault/records/${record.id}/access`));
            })
          }
          disabled={pending}
        >
          {t('vault.access')}
        </Button>
      )}
      {access && (
        <ul>
          {access.length === 0 && <li>{t('vault.noAccess')}</li>}
          {access.map((entry) => (
            <li key={entry.createdAt}>
              {t('vault.accessEntry', {
                who: entry.accessorName ?? entry.accessorRole,
                via: t(entry.via === 'external_link' ? 'vault.viaLink' : 'vault.viaBooking'),
                time: formatDateTime(new Date(entry.createdAt), locale),
              })}
            </li>
          ))}
        </ul>
      )}
      {onDelete && record.source === 'patient' && (
        <Button
          className="heach-button--danger"
          onClick={() => void run(onDelete)}
          disabled={pending}
        >
          {t('vault.delete')}
        </Button>
      )}
    </Card>
  );
}
