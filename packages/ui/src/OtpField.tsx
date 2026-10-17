import { type InputHTMLAttributes, useId } from 'react';
import { Field } from './Field.js';

export interface OtpFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'inputMode' | 'autoComplete'
> {
  label: string;
  hint?: string | undefined;
  /** On error the digits stay, so the user can correct one (UX-05.1). */
  error?: string | undefined;
  length?: number | undefined;
}

/**
 * One-time password entry (UX-05): a single numeric field that phones fill from the SMS
 * (`autocomplete="one-time-code"`) and that opens the number pad (`inputmode="numeric"`).
 */
export function OtpField({ label, hint, error, length = 6, ...rest }: Readonly<OtpFieldProps>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          {...rest}
          id={id}
          className="heach-input heach-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`[0-9]{${String(length)}}`}
          maxLength={length}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
      )}
    </Field>
  );
}
