import { useId } from 'react';

export interface Choice {
  value: string;
  label: string;
  hint?: string | undefined;
  /** BCP 47 code when the label is in another language (A11Y-05). */
  lang?: string | undefined;
}

export interface ChoiceGroupProps {
  legend: string;
  choices: readonly Choice[];
  /** One value (radio buttons) or several (checkboxes). */
  value: string | readonly string[];
  onChange: (value: string, checked: boolean) => void;
  multiple?: boolean | undefined;
  error?: string | undefined;
  name?: string | undefined;
}

/**
 * Options as large labelled cards (design reference: verification method, role choice). Native
 * radio buttons or checkboxes in a fieldset, so keyboards and screen readers work as usual.
 */
export function ChoiceGroup({
  legend,
  choices,
  value,
  onChange,
  multiple = false,
  error,
  name,
}: Readonly<ChoiceGroupProps>) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const selected = typeof value === 'string' ? [value] : value;
  return (
    <fieldset className="heach-choice-group" aria-describedby={errorId}>
      <legend>{legend}</legend>
      {choices.map((choice) => (
        <label key={choice.value} className="heach-choice">
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={name ?? id}
            value={choice.value}
            checked={selected.includes(choice.value)}
            onChange={(event) => {
              onChange(choice.value, event.target.checked);
            }}
          />
          <span className="heach-choice__text">
            <span className="heach-choice__label" lang={choice.lang}>
              {choice.label}
            </span>
            {choice.hint && <span className="heach-choice__hint">{choice.hint}</span>}
          </span>
        </label>
      ))}
      {error && (
        <p id={errorId} className="heach-field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
