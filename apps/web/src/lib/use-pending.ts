'use client';

import { useCallback, useRef, useState } from 'react';
import type { MessageKey, Messages } from '@heach/i18n';
import { errorMessageKey } from './errors';

/**
 * Runs one action at a time: a second tap while the first is in flight does nothing (duplicate
 * submissions), and a failure becomes a translated message key, never the raw error.
 */
export function usePending() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey<Messages> | undefined>();
  const run = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(errorMessageKey(caught));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  return { pending, error, setError, run };
}
