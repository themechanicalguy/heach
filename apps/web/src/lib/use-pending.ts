'use client';

import { usePendingAction } from '@heach/ui';
import { errorMessageKey } from './errors';

/**
 * Runs one action at a time: a second tap while the first is in flight does nothing (duplicate
 * submissions), and a failure becomes a translated message key, never the raw error.
 */
export function usePending() {
  return usePendingAction(errorMessageKey);
}
