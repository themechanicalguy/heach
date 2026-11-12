import { Notice, TextField } from '@heach/ui';
import { errorText } from '../i18n';

/** The failure of the last call, if any. */
export function ErrorNotice({ error }: Readonly<{ error: unknown }>) {
  if (error === undefined) return null;
  return (
    <Notice tone="danger" live>
      {errorText(error)}
    </Notice>
  );
}

interface FileFieldProps {
  label: string;
  accept: string;
  /** Changing it clears the chosen file, for example after an upload. */
  version: number;
  onFile: (file: File | undefined) => void;
}

/** A file chooser; the file is read only when uploaded and never shown again. */
export function FileField({ label, accept, version, onFile }: Readonly<FileFieldProps>) {
  return (
    <TextField
      key={version}
      label={label}
      type="file"
      accept={accept}
      onChange={(event) => {
        onFile(event.currentTarget.files?.[0]);
      }}
    />
  );
}
