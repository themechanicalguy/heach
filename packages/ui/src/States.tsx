import { Button } from './Button.js';

/** Loading placeholder (UX-04): shapes for sighted users, the label for screen readers. */
export function Skeleton({ label, lines = 3 }: Readonly<{ label: string; lines?: number }>) {
  return (
    <div className="heach-skeleton" role="status" aria-busy="true">
      <span className="heach-visually-hidden">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="heach-skeleton__line" aria-hidden="true" />
      ))}
    </div>
  );
}

export function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <p className="heach-state heach-state--empty" role="status">
      {message}
    </p>
  );
}

export interface ErrorStateProps {
  message: string;
  retryLabel?: string | undefined;
  onRetry?: (() => void) | undefined;
}

export function ErrorState({ message, retryLabel, onRetry }: Readonly<ErrorStateProps>) {
  return (
    <div className="heach-state heach-state--error" role="alert">
      <p>{message}</p>
      {onRetry && retryLabel && <Button onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}

/** Shown while the device is offline (UX-04, PF-07). */
export function OfflineBanner({ message }: Readonly<{ message: string }>) {
  return (
    <div className="heach-offline" role="status">
      {message}
    </div>
  );
}
