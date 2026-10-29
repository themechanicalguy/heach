import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string | undefined;
}

/** One labelled checkbox with its error below (A11Y-04); the box stays as the user left it. */
export function CheckboxField({ label, error, ...rest }: Readonly<CheckboxFieldProps>) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="heach-field">
      <label className="heach-checkbox">
        <input
          {...rest}
          type="checkbox"
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={errorId} className="heach-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
