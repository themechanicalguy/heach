import { useCallback, useRef, useState } from 'react';

/** An action the app runs on a tap or a submit. */
export type Action = () => Promise<void>;

/**
 * Runs one action at a time: a second tap while the first is in flight does nothing (duplicate
 * submissions), and a failure is kept as `describe` turns it, for the app to show. `describe`
 * must not change between renders (a function defined outside the component), so `run` stays
 * the same and effects that depend on it run once.
 */
export function usePendingAction<E>(describe: (caught: unknown) => E) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<E | undefined>();
  const run = useCallback(
    async (action: Action) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError(undefined);
      try {
        await action();
      } catch (caught) {
        setError(describe(caught));
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [describe],
  );
  return { pending, error, setError, run };
}

/**
 * For a sensitive action (AC-05, decision L-11): when the server asks for a fresh code, the
 * action waits while the app shows its code sheet (`verifying`), then runs again once the code is
 * proven (`verified`), or is dropped (`cancel`). `run` is the caller's one-at-a-time runner and
 * `needsCode` tells the server's request for a code from any other failure; it must not change
 * between renders either.
 */
export function useRetryAfterCode(
  run: (action: Action) => Promise<void>,
  needsCode: (caught: unknown) => boolean,
) {
  const [verifying, setVerifying] = useState(false);
  const waiting = useRef<Action | undefined>(undefined);
  const attempt = useCallback(
    (action: Action) =>
      run(async () => {
        try {
          await action();
        } catch (caught) {
          if (!needsCode(caught)) throw caught;
          waiting.current = action;
          setVerifying(true);
        }
      }),
    [run, needsCode],
  );
  const cancel = useCallback(() => {
    waiting.current = undefined;
    setVerifying(false);
  }, []);
  const verified = useCallback(() => {
    setVerifying(false);
    const action = waiting.current;
    waiting.current = undefined;
    if (action) void attempt(action);
  }, [attempt]);
  return { attempt, verifying, cancel, verified };
}
