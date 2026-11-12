import { Button, Notice } from '@heach/ui';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { ImageViewer } from './ImageViewer';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];

interface OpenFile {
  href: string;
  image: boolean;
}

/**
 * Fetches a stored file on request. Images open in the page with zoom and rotate; other files
 * (PDF) open as a link to a new tab. The API audits every opening; the object URL is revoked
 * when the viewer closes or this button goes away.
 */
export function StoredFileButton({ path }: Readonly<{ path: string }>) {
  const { pending, error, run } = usePending();
  const [file, setFile] = useState<OpenFile | undefined>();
  const href = useRef<string | undefined>(undefined);
  useEffect(
    () => () => {
      if (href.current) URL.revokeObjectURL(href.current);
    },
    [],
  );
  const open = () =>
    run(async () => {
      const stored = await api<{ contentType: string; contentBase64: string }>(path);
      const bytes = Uint8Array.from(atob(stored.contentBase64), (char) => char.charCodeAt(0));
      href.current = URL.createObjectURL(new Blob([bytes], { type: stored.contentType }));
      setFile({ href: href.current, image: IMAGE_TYPES.includes(stored.contentType) });
    });
  const close = () => {
    if (href.current) URL.revokeObjectURL(href.current);
    href.current = undefined;
    setFile(undefined);
  };
  if (file?.image) return <ImageViewer src={file.href} onClose={close} />;
  if (file) {
    return (
      <a href={file.href} target="_blank" rel="noreferrer">
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
