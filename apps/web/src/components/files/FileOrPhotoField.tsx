'use client';

import { Button, TextField } from '@heach/ui';
import { type ChangeEvent, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n-context';
import { shrinkPhoto, withPrepared } from '../../lib/photo';
import { useAppAudience } from '../../lib/use-app-audience';

interface Props {
  label: string;
  hint?: string;
  /** File types the upload accepts; a photo is always a JPEG. */
  accept: string;
  onFile: (file: File | undefined) => void;
}

/**
 * A file upload that, inside the apps, also offers the camera (MA-06): the app's file picker
 * lists files only, so a button opens the camera. Browsers already offer both. A large picked
 * image is made smaller before it is handed on (PO-02).
 */
export function FileOrPhotoField({ label, hint, accept, onFile }: Readonly<Props>) {
  const { t } = useI18n();
  const inApp = useAppAudience() !== undefined;
  const camera = useRef<HTMLInputElement>(null);
  // Which source holds the file in use; choosing with one empties the other.
  const [source, setSource] = useState<'file' | 'photo'>();
  const [fileKey, setFileKey] = useState(0);
  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    withPrepared(event.currentTarget.files?.[0], onFile);
    setSource('file');
  };
  const pickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const photo = input.files?.[0];
    if (!photo) return;
    onFile(await shrinkPhoto(photo));
    setSource('photo');
    setFileKey((key) => key + 1);
    input.value = '';
  };
  return (
    <>
      <TextField
        key={fileKey}
        label={label}
        hint={hint}
        type="file"
        accept={accept}
        onChange={pickFile}
      />
      {inApp && (
        <div className="flow__form">
          <input
            ref={camera}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => void pickPhoto(event)}
          />
          <Button className="heach-button--secondary" onClick={() => camera.current?.click()}>
            {t('app.takePhoto')}
          </Button>
          {source === 'photo' && <p role="status">{t('app.photoAdded')}</p>}
        </div>
      )}
    </>
  );
}
