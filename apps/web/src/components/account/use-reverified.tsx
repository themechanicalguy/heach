'use client';

import { type Action, useRetryAfterCode } from '@heach/ui';
import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { ReverifySheet } from './ReverifySheet';

const needsCode = (caught: unknown) =>
  caught instanceof ApiError && caught.code === 'reverification_required';

/**
 * Runs a sensitive action; when the API answers `reverification_required`, asks for a fresh OTP
 * in a sheet and then runs the same action again (AC-05, decision L-11). `run` is the caller's
 * one-at-a-time runner (`usePending`).
 */
export function useReverified(run: (action: Action) => Promise<void>): {
  attempt: (action: Action) => Promise<void>;
  sheet: ReactNode;
} {
  const { attempt, verifying, cancel, verified } = useRetryAfterCode(run, needsCode);
  const sheet = <ReverifySheet open={verifying} onClose={cancel} onVerified={verified} />;
  return { attempt, sheet };
}
