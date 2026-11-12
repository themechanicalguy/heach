import { Button, Notice } from '@heach/ui';
import { apiBlob } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';
import { type AuditFilterValues, auditQuery } from './audit-query';

function download(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'audit-log.csv';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Exports the filtered log as CSV after a fresh TOTP code (AD-11); the token goes in the header. */
export function AuditExport({ filters }: Readonly<{ filters: AuditFilterValues }>) {
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  return (
    <>
      <p>{t('audit.exportNote')}</p>
      <Button
        className="heach-button--secondary"
        disabled={pending}
        onClick={() =>
          void attempt(async () => {
            download(await apiBlob(`/audit/export?${auditQuery(filters)}`));
          })
        }
      >
        {t('audit.export')}
      </Button>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {sheet}
    </>
  );
}
