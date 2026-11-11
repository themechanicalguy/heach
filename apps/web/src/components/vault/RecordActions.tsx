'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Notice } from '@heach/ui';
import type { RecordAccess, StoredFile, VaultRecord } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { FileDownload } from '../files/FileDownload';
import { usePending } from '../../lib/use-pending';

export interface RecordActionProps {
  record: VaultRecord;
  /** Where the file comes from: the owner's vault or a provider's share. */
  filePath?: string | undefined;
  onDelete?: (() => Promise<void>) | undefined;
  showAccess?: boolean;
}

export function RecordActions({
  record,
  filePath,
  onDelete,
  showAccess = false,
}: Readonly<RecordActionProps>) {
  const { locale, t } = useI18n();
  const [file, setFile] = useState<StoredFile>();
  const [access, setAccess] = useState<RecordAccess[] | undefined>();
  const { pending, error, run } = usePending();
  const open = () =>
    run(async () => {
      setFile(await api<StoredFile>(filePath ?? `/vault/records/${record.id}/file`));
    });
  return (
    <div className="actions">
      {record.hasFile &&
        (file ? (
          <FileDownload file={file} name={record.title} label={t('vault.download')} />
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
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
    </div>
  );
}
