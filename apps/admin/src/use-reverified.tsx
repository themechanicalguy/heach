import { type Action, useRetryAfterCode } from '@heach/ui';
import type { ReactNode } from 'react';
import { ApiError } from './api';
import { ReverifySheet } from './pages/ReverifySheet';

const needsCode = (caught: unknown) =>
  caught instanceof ApiError && caught.code === 'reverification_required';

/**
 * Runs a sensitive action; when the API answers `reverification_required`, asks for a fresh TOTP
 * code and then runs the same action again (decision L-11). `run` comes from `usePending`.
 */
export function useReverified(run: (action: Action) => Promise<void>): {
  attempt: (action: Action) => Promise<void>;
  sheet: ReactNode;
} {
  const { attempt, verifying, cancel, verified } = useRetryAfterCode(run, needsCode);
  const sheet = <ReverifySheet open={verifying} onClose={cancel} onVerified={verified} />;
  return { attempt, sheet };
}
