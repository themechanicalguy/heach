'use client';

import type { StoredFile } from '@heach/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { openInApp } from '../../lib/app-files';
import { useI18n } from '../../lib/i18n-context';
import { useAppAudience } from '../../lib/use-app-audience';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** The download name: `name` with the extension of the file's real type (a JPG is not a .pdf). */
export function downloadName(name: string, contentType: string): string {
  return `${name}.${EXTENSIONS[contentType] ?? 'bin'}`;
}

/** Inside the apps a download link does nothing: the app opens the file (MA-06). */
function OpenInApp({
  file,
  name,
  label,
}: Readonly<{ file: StoredFile; name: string; label: string }>) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const opened = useRef<StoredFile | undefined>(undefined);
  const open = useCallback(() => {
    openInApp({
      name: downloadName(name, file.contentType),
      contentType: file.contentType,
      contentBase64: file.contentBase64,
    }).then(
      () => {
        setFailed(false);
      },
      () => {
        setFailed(true);
      },
    );
  }, [file, name]);
  // The tap that fetched the file also opens it; the button stays to open it again.
  useEffect(() => {
    if (opened.current === file) return;
    opened.current = file;
    open();
  }, [file, open]);
  return (
    <>
      <button type="button" className="heach-button heach-button--secondary" onClick={open}>
        {label}
      </button>
      {failed && <p role="alert">{t('errors.generic')}</p>}
    </>
  );
}

/**
 * Authorized file bytes stay in memory, never in a data URL (browsers also refuse to open those
 * in a new tab); dispose the opaque URL on exit. `name` has no extension: the file's type sets it.
 */
export function FileDownload({
  file,
  name,
  label,
}: Readonly<{ file: StoredFile; name: string; label: string }>) {
  const inApp = useAppAudience() !== undefined;
  const [download, setDownload] = useState<{ file: StoredFile; url: string }>();
  useEffect(() => {
    // The apps hand the file to the phone instead (OpenInApp); no link is made for them.
    if (inApp) return undefined;
    const bytes = Uint8Array.from(atob(file.contentBase64), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
    setDownload({ file, url });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, inApp]);
  if (inApp) return <OpenInApp file={file} name={name} label={label} />;
  return download?.file === file ? (
    <a
      className="heach-button heach-button--secondary"
      href={download.url}
      download={downloadName(name, file.contentType)}
    >
      {label}
    </a>
  ) : (
    <span aria-busy="true">{label}</span>
  );
}
