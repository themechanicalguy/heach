'use client';

import type { StoredFile } from '@heach/types';
import { useEffect, useState } from 'react';

/** Authorized file bytes stay in memory, never in a data URL; dispose the opaque URL on exit. */
export function FileDownload({
  file,
  filename,
  label,
}: Readonly<{ file: StoredFile; filename: string; label: string }>) {
  const [download, setDownload] = useState<{ file: StoredFile; url: string }>();
  useEffect(() => {
    const bytes = Uint8Array.from(atob(file.contentBase64), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
    setDownload({ file, url });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return download?.file === file ? (
    <a className="heach-button heach-button--secondary" href={download.url} download={filename}>
      {label}
    </a>
  ) : (
    <span aria-busy="true">{label}</span>
  );
}
