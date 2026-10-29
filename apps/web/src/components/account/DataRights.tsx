'use client';

import { Button, Notice } from '@heach/ui';
import type { AccountExport, Me } from '@heach/types';
import { formatDate } from '@heach/i18n';
import { useAccount } from '../../lib/account';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useReverified } from './use-reverified';

/** Hands the export to the browser as a file; nothing is kept on the device afterwards (EN-11). */
function download(data: AccountExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'heach-account-data.json';
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The account holder's data rights (AC-06, PR-04): download everything held, and ask for the
 * account to be deleted. Both need a fresh code first. The request is recorded; carrying it out
 * is done by the team (default D-3).
 */
export function DataRights({ me }: Readonly<{ me: Me }>) {
  const { locale, t } = useI18n();
  const { reload } = useAccount();
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const requestedAt = me.deletionRequestedAt;

  const exportData = () =>
    attempt(async () => {
      download(await api<AccountExport>('/me/export'));
    });
  const requestDeletion = () =>
    attempt(async () => {
      await api('/me/deletion-request', { method: 'POST' });
      await reload();
    });
  const cancelDeletion = () =>
    run(async () => {
      await api('/me/deletion-request', { method: 'DELETE' });
      await reload();
    });

  return (
    <section className="flow__card" aria-labelledby="data-title">
      <h2 id="data-title" className="flow__subtitle">
        {t('dataRights.title')}
      </h2>
      <p>{t('dataRights.exportIntro')}</p>
      <Button
        className="heach-button--secondary"
        onClick={() => void exportData()}
        disabled={pending}
      >
        {t('dataRights.export')}
      </Button>
      {requestedAt ? (
        <>
          <Notice tone="warning" live>
            {t('dataRights.requested', { date: formatDate(new Date(requestedAt), locale) })}
          </Notice>
          <Button
            className="heach-button--secondary"
            onClick={() => void cancelDeletion()}
            disabled={pending}
          >
            {t('dataRights.cancel')}
          </Button>
        </>
      ) : (
        <>
          <p>{t('dataRights.deleteIntro')}</p>
          <Button
            className="heach-button--danger"
            onClick={() => void requestDeletion()}
            disabled={pending}
          >
            {t('dataRights.delete')}
          </Button>
        </>
      )}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {sheet}
    </section>
  );
}
