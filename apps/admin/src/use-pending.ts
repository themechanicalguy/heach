import { usePendingAction } from '@heach/ui';

/** Keeps the failure itself; pages turn it into text with `errorText`. */
const keepFailure = (caught: unknown): unknown => caught ?? new Error('failed');

/** One action at a time (no duplicate submissions); keeps the failure to show. */
export function usePending() {
  const { pending, error, run } = usePendingAction(keepFailure);
  return { pending, error, run };
}
