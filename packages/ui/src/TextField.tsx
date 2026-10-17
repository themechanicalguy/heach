import { type InputHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';
import { Field } from './Field.js';

interface Common {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

export type TextFieldProps = Common &
  (
    | ({ multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>)
    | ({ multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>)
  );

const FIELD_ONLY = new Set(['label', 'hint', 'error', 'multiline']);

/** The props that belong on the input or textarea element itself. */
function controlProps(props: Readonly<TextFieldProps>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([key]) => !FIELD_ONLY.has(key)));
}

/** Labelled text input, or textarea with `multiline`; errors never clear what was typed. */
export function TextField(props: Readonly<TextFieldProps>) {
  const id = useId();
  const { label, hint, error, multiline } = props;
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(describedBy) => {
        const attributes = {
          ...controlProps(props),
          id,
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : undefined,
        };
        return multiline ? (
          <textarea className="heach-input heach-input--multiline" {...attributes} />
        ) : (
          <input className="heach-input" {...attributes} />
        );
      }}
    </Field>
  );
}
