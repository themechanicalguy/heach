import { type ReactNode, useCallback, useRef, useState } from 'react';
import { ApiError } from './api';
import { ReverifySheet } from './pages/ReverifySheet';

/**
 * Runs a sensitive action; when the API answers `reverification_required`, asks for a fresh TOTP
 * code and then runs the same action again (decision L-11). `run` comes from `usePending`.
 */
export function useReverified(run: (action: () => Promise<void>) => Promise<void>): {
  attempt: (action: () => Promise<void>) => Promise<void>;
  sheet: ReactNode;
} {
  const [verifying, setVerifying] = useState(false);
  const waiting = useRef<(() => Promise<void>) | undefined>(undefined);
  const attempt = useCallback(
    (action: () => Promise<void>) =>
      run(async () => {
        try {
          await action();
        } catch (caught) {
          if (caught instanceof ApiError && caught.code === 'reverification_required') {
            waiting.current = action;
            setVerifying(true);
            return;
          }
          throw caught;
        }
      }),
    [run],
  );
  const sheet = (
    <ReverifySheet
      open={verifying}
      onClose={() => {
        waiting.current = undefined;
        setVerifying(false);
      }}
      onVerified={() => {
        setVerifying(false);
        const action = waiting.current;
        waiting.current = undefined;
        if (action) void attempt(action);
      }}
    />
  );
  return { attempt, sheet };
}
