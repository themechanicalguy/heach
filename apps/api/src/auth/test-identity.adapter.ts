import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '../config/env.schema.js';

/** Environments where the test identity adapter may run (SE-07.4). Step 3 brings OTP login. */
export const TEST_LOGIN_ENVS: readonly AppEnv[] = ['local', 'test', 'dev'];

/** Added by the dev host's loopback-only proxy entry; the public entry strips it (SE-07.23). */
export const TEST_LOGIN_KEY_HEADER = 'x-test-login-key';

/** Throws at start-up when test login would be reachable outside dev and test. */
export function assertTestLoginAllowed(appEnv: AppEnv): void {
  if (!TEST_LOGIN_ENVS.includes(appEnv)) {
    throw new Error(`Test identity adapter refused in ${appEnv}`);
  }
}

/** Environments where test sign-in works without a key: nothing there is reachable by others. */
const OPEN_WITHOUT_KEY: readonly AppEnv[] = ['local', 'test'];

/**
 * Whether a test sign-in may go ahead (SE-07.23). Never outside local, test and dev. Wherever a key
 * is configured, the request must carry it; the deployed dev host without a key refuses every
 * request. Local and test runs without a key stay open for synthetic users.
 */
export function testLoginPermitted(
  appEnv: AppEnv,
  configuredKey: string | undefined,
  presentedKey: string | undefined,
): boolean {
  if (!TEST_LOGIN_ENVS.includes(appEnv)) {
    return false;
  }
  if (!configuredKey) {
    return OPEN_WITHOUT_KEY.includes(appEnv);
  }
  // Equal-length digests, so the comparison takes the same time whatever was sent.
  return presentedKey !== undefined && timingSafeEqual(digest(configuredKey), digest(presentedKey));
}

const digest = (value: string) => createHash('sha256').update(value).digest();
