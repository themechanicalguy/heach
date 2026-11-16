'use client';

import { TextField } from '@heach/ui';
import { type ChangeEvent, useState } from 'react';
import { useI18n } from '../../lib/i18n-context';
import { useAppAudience } from '../../lib/use-app-audience';

interface Props {
  label: string;
  hint?: string;
  /** File types the upload accepts; a photo is always a JPEG. */
  accept: string;
  onFile: (file: File | undefined) => void;
}

/**
 * A file upload that, inside the Android apps, also offers the camera (MA-06): the app's file
 * picker lists files only, so a second field opens the camera. Browsers already offer both.
 */
export function FileOrPhotoField({ label, hint, accept, onFile }: Readonly<Props>) {
  const { t } = useI18n();
  const inApp = useAppAudience() !== undefined;
  // Choosing with one field empties the other, so only the file in use is shown.
  const [cleared, setCleared] = useState({ file: 0, photo: 0 });
  const pick = (other: 'file' | 'photo') => (event: ChangeEvent<HTMLInputElement>) => {
    onFile(event.currentTarget.files?.[0]);
    setCleared((counts) => ({ ...counts, [other]: counts[other] + 1 }));
  };
  return (
    <>
      <TextField
        key={cleared.file}
        label={label}
        hint={hint}
        type="file"
        accept={accept}
        onChange={pick('photo')}
      />
      {inApp && (
        <TextField
          key={cleared.photo}
          label={t('app.takePhoto')}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pick('file')}
        />
      )}
    </>
  );
}
