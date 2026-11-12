import { Button, Notice } from '@heach/ui';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';

/** Fetches a stored file on request and then offers it as a link; the API audits every opening. */
export function StoredFileButton({ path }: Readonly<{ path: string }>) {
  const { pending, error, run } = usePending();
  const [href, setHref] = useState<string | undefined>();
  const open = () =>
    run(async () => {
      const file = await api<{ contentType: string; contentBase64: string }>(path);
      const bytes = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
      setHref(URL.createObjectURL(new Blob([bytes], { type: file.contentType })));
    });
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {t('verification.download')}
      </a>
    );
  }
  return (
    <>
      <Button className="heach-button--secondary" onClick={() => void open()} disabled={pending}>
        {t('verification.download')}
      </Button>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
    </>
  );
}
