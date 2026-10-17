export interface ToastProps {
  message: string;
  tone?: 'success' | 'error' | 'info' | undefined;
  dismissLabel?: string | undefined;
  onDismiss?: (() => void) | undefined;
}

/** Short status message, announced politely; errors are announced at once. */
export function Toast({ message, tone = 'info', dismissLabel, onDismiss }: Readonly<ToastProps>) {
  return (
    <div
      className={`heach-toast heach-toast--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span>{message}</span>
      {onDismiss && dismissLabel && (
        <button type="button" className="heach-button heach-button--ghost" onClick={onDismiss}>
          {dismissLabel}
        </button>
      )}
    </div>
  );
}
