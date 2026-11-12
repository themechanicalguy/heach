import type { AssistedApplication, AssistedSession } from '@heach/types';
import { ApiError } from './api';
import { usePending } from './use-pending';
import { useReverified } from './use-reverified';

/** Called with the new session view, or `null` once the session has ended. */
export type SessionHandler = (next: AssistedSession | null) => void;

/** What every step after the basic details receives. */
export interface StepProps {
  session: AssistedSession;
  application: AssistedApplication;
  onSession: SessionHandler;
}

/** An assisted-onboarding route for the running session; never carries a number or a name. */
export function assistedPath(session: AssistedSession, tail: string): string {
  return `/assisted-onboarding/sessions/${session.sessionId}${tail}`;
}

/**
 * Runs the calls of an assisted-onboarding step (AD-12): one at a time, with the failure to show,
 * the fresh-TOTP flow for sensitive calls, and a session that ended meanwhile handed to the page.
 */
export function useAssistedCall(onSession: SessionHandler) {
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const guard = (action: () => Promise<void>) => async () => {
    try {
      await action();
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.code !== 'assisted_session_ended') throw caught;
      onSession(null);
    }
  };
  const forSession = (action: () => Promise<AssistedSession>) =>
    guard(async () => {
      onSession(await action());
    });
  return {
    pending,
    error,
    sheet,
    /** A call that answers with the session view. */
    call: (action: () => Promise<AssistedSession>) => run(forSession(action)),
    /** The same, for a call that needs a fresh authenticator code. */
    sensitive: (action: () => Promise<AssistedSession>) => attempt(forSession(action)),
    /** A call that answers with something else (a challenge, nothing). */
    other: (action: () => Promise<void>) => run(guard(action)),
    /** The same, for a call that needs a fresh authenticator code. */
    otherSensitive: (action: () => Promise<void>) => attempt(guard(action)),
  };
}
