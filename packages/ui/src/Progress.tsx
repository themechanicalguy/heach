export interface ProgressProps {
  /** Steps done or under way, from 1. */
  current: number;
  total: number;
  /** Visible and announced text, for example "Step 2 of 4", from the caller's messages. */
  label: string;
}

/** Segmented step progress (design reference, onboarding A), announced as a progress bar. */
export function Progress({ current, total, label }: Readonly<ProgressProps>) {
  return (
    <div className="heach-progress">
      <span className="heach-progress__label" aria-hidden="true">
        {label}
      </span>
      <div
        className="heach-progress__bar"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={label}
      >
        {Array.from({ length: total }, (_, index) => (
          <span key={index} data-done={index < current ? 'true' : 'false'} />
        ))}
      </div>
    </div>
  );
}
