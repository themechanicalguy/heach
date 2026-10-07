import type { ButtonHTMLAttributes, Ref } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Native button with a safe default `type="button"` (no accidental form submits).
 * Callers pass the label as children, from their messages, never as a hard-coded string.
 * Styling arrives with design tokens in Step 2; until then `heach-button` comes from ui.css.
 */
export function Button({ type = 'button', className, ...props }: Readonly<ButtonProps>) {
  const classes = className ? `heach-button ${className}` : 'heach-button';
  return <button type={type} className={classes} {...props} />;
}
