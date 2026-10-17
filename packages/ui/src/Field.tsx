import type { ReactNode } from 'react';

export interface FieldProps {
  id: string;
  label: string;
  hint?: string | undefined;
  /** Shown below the control and announced; the control keeps its value. */
  error?: string | undefined;
  children: (describedBy: string | undefined) => ReactNode;
}

/** Label, hint and error wiring shared by the form controls (A11Y: labelled, described). */
export function Field({ id, label, hint, error, children }: Readonly<FieldProps>) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="heach-field">
      <label className="heach-field__label" htmlFor={id}>
        {label}
      </label>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className="heach-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="heach-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
