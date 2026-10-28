import { useCallback, useRef, useState } from 'react';

/** One action at a time (no duplicate submissions); keeps the failure to show. */
export function usePending() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const run = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(caught ?? new Error('failed'));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  return { pending, error, run };
}
