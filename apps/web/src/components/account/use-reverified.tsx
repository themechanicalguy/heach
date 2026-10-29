'use client';

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { ReverifySheet } from './ReverifySheet';

/**
 * Runs a sensitive action; when the API answers `reverification_required`, asks for a fresh OTP
 * in a sheet and then runs the same action again (AC-05, decision L-11). `run` is the caller's
 * one-at-a-time runner (`usePending`).
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
