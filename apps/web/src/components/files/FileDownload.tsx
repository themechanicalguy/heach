'use client';

import type { StoredFile } from '@heach/types';
import { useEffect, useState } from 'react';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** The download name: `name` with the extension of the file's real type (a JPG is not a .pdf). */
export function downloadName(name: string, contentType: string): string {
  return `${name}.${EXTENSIONS[contentType] ?? 'bin'}`;
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
